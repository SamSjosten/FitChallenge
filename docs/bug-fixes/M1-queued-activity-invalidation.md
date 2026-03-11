# M1. Queued Activity Skips Cache Invalidation Permanently

**Severity:** MEDIUM
**Status:** IMPLEMENTED
**Date:** 2026-03-11
**Cross-ref:** Plan item M1, `eager-puzzling-frog.md`

---

## Decision Record

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Fix location | Centralized `invalidateAfterSync()` helper called from hook layer | Single source of truth prevents drift across callsites |
| Query keys module | New `src/lib/queryKeys.ts` | Avoids hook-to-hook import coupling; pure data with no React dependencies |
| Invalidation scope | Broad (`challengeKeys.all`, `activityKeys.all`) | Queue doesn't track challenge IDs; React Query only refetches mounted queries |
| Invalidation trigger | After `processQueue()` resolves with `succeeded > 0` | Only invalidate when items actually synced |
| Concurrency | Tolerate duplicates; `succeeded > 0` guard is sufficient | Store's `isProcessing` returns `succeeded: 0` for concurrent callers (see §5) |
| OfflineIndicator | **Required**: switch to `useOfflineQueue` hook | Manual sync tap is a correctness path, not just an edge case |
| `_layout.tsx` | Import `invalidateAfterSync` directly | Startup-specific `useEffect` logic doesn't fit `useOfflineQueue` shape |

---

## 1. Problem Statement

When a user logs an activity while **online**, the mutation's `onSettled` callback invalidates three React Query caches — challenge detail, leaderboard, and recent activities. The UI immediately refetches server-authoritative data.

When a user logs an activity while **offline**, the same `onSettled` callback **skips all invalidation** and returns early. The comment says invalidation "will happen on sync" — but **no sync path ever triggers it**.

### The buggy code

```typescript
// src/hooks/useChallenges.ts lines 311-316
onSettled: (data, error, variables) => {
  // If queued, don't invalidate yet - will happen on sync
  if (data?.queued) {
    console.log("[useLogActivity] Activity queued for offline sync");
    return;  // <- EARLY RETURN: all 3 invalidateQueries calls skipped
  }

  // These only run for online path:
  queryClient.invalidateQueries({ queryKey: challengeKeys.leaderboard(variables.challenge_id) });
  queryClient.invalidateQueries({ queryKey: challengeKeys.detail(variables.challenge_id) });
  queryClient.invalidateQueries({ queryKey: activityKeys.all });
},
```

The identical pattern exists in `useLogWorkout()` at lines 388-392.

### The broken promise

The comment says "will happen on sync." Here's what actually happens on sync:

1. Network reconnects -> `useNetworkStatus.ts` line 51 detects reconnection
2. Calls `processQueue()` fire-and-forget (line 55)
3. `processQueue()` in `offlineStore.ts` iterates queued items, calls `executeAction()` for each
4. `executeAction()` calls `supabase.rpc("log_activity", ...)` -- **database updated**
5. `processQueue()` returns `{ processed, succeeded, failed, remaining }`
6. **Nobody reads the result. Nobody invalidates any cache.**

### The architecture gap

```
+-------------------------+      +--------------------------+
|   React Query Layer     |      |     Zustand Layer        |
|                         |      |                          |
|  useLogActivity()       |      |  offlineStore            |
|    onSettled -> skip     | ---- |    addToQueue()          |
|    (no invalidation)    |      |                          |
|                         |      |  processQueue()          |
|  queryClient.           |  X   |    executeAction() -> DB |
|    invalidateQueries()  | <--  |    returns result        |
|                         |      |    (nobody reads it)     |
+-------------------------+      +--------------------------+
```

The Zustand store knows *when* sync completes but can't reach the query client. The mutation hook knows *what* to invalidate but skips it when queued.

### All `processQueue()` callers (5 total, 0 invalidate)

| # | Caller | File | Line | Trigger |
|---|--------|------|------|---------|
| 1 | `useNetworkStatus` | `src/hooks/useNetworkStatus.ts` | 55 | Network reconnect |
| 2 | `useOfflineQueue.enqueue` | `src/hooks/useOfflineQueue.ts` | 45 | Enqueue-while-online |
| 3 | `useOfflineQueue.processNow` | `src/hooks/useOfflineQueue.ts` | 56 | Manual trigger |
| 4 | `RootLayoutNav` | `app/_layout.tsx` | 151 | App startup with pending items |
| 5 | `OfflineIndicator` | `src/components/OfflineIndicator.tsx` | 84 | Manual sync tap (direct store call) |

---

## 2. Root Cause Analysis

### Why was invalidation skipped?

The developer's reasoning was correct in principle:

1. Activity is queued -> not yet in the database -> invalidating now would refetch stale server data
2. Invalidation should happen *after* the queue processes the item

The mistake was implementing the "skip" half without implementing the "invalidate later" half. This is a common **split-implementation bug**: one side of a two-part change ships, the other doesn't.

### Why didn't the gap surface sooner?

Three factors mask the bug in normal usage:

1. **Optimistic updates work.** `onMutate` immediately updates the challenge detail cache. The UI *looks* correct.
2. **Short offline windows.** Most users go offline briefly. The optimistic data is close enough to server truth.
3. **Screen navigation invalidates.** Leaving and returning to the challenge screen may trigger a refetch via `staleTime`.

The bug surfaces when:
- User logs multiple activities offline
- User stays on the challenge screen after reconnection
- Server-side calculations (leaderboard rank, point totals, daily streaks) diverge from optimistic estimates

---

## 3. Teaching: The Cache Invalidation Lifecycle

### Online path (correct)

```
User taps "Log Activity"
  -> mutationFn: activityService.logActivity() -> supabase.rpc("log_activity") -> DB updated
  -> onSettled: queryClient.invalidateQueries(challengeKeys.detail, leaderboard, activityKeys.all)
  -> React Query refetches -> UI shows server-authoritative data
```

### Offline path (broken)

```
User taps "Log Activity"
  -> mutationFn: activityService.logActivity() -> checks network -> offline -> queues item
  -> returns { queued: true }
  -> onSettled: sees queued=true -> returns early (no invalidation)
  -> onMutate already applied optimistic update -> UI looks OK

... time passes, user reconnects ...

  -> useNetworkStatus detects reconnection
  -> processQueue() -> executeAction() -> supabase.rpc("log_activity") -> DB updated
  -> processQueue() returns { succeeded: 1 }
  -> nobody reads the result -> no invalidation -> stale cache persists
```

### The principle

Invalidation must be coupled to the **data write**, not the **user action**. It doesn't matter *when* the data hits the database. What matters is that *whenever* it does, the cache is invalidated.

---

## 4. The Fix

### Approach: Centralized `invalidateAfterSync` helper

Rather than inlining invalidation logic in each caller (which drifts over time), a shared helper in `src/lib/invalidateAfterSync.ts` is called by every `processQueue()` callsite that has React context.

### New module: `src/lib/queryKeys.ts`

Query key factories moved from individual hook files to a neutral module. This prevents hook-to-hook import coupling (e.g., `useNetworkStatus` importing from `useChallenges`). Each hook re-exports its keys for backward compatibility.

### New module: `src/lib/invalidateAfterSync.ts`

```typescript
export function invalidateAfterSync(
  result: ProcessQueueResult,
  queryClient: QueryClient,
): boolean {
  if (result.succeeded > 0) {
    queryClient.invalidateQueries({ queryKey: challengeKeys.all });
    queryClient.invalidateQueries({ queryKey: activityKeys.all });
    console.log(`[OfflineSync] Invalidated caches after sync (...)`);
    return true;
  }
  return false;
}
```

### Why broad invalidation?

- `challengeKeys.all` invalidates all challenge queries -- React Query only refetches *mounted* queries
- `activityKeys.all` is already the pattern used in the online path (line 327)
- Broad invalidation is cheap -- marks caches as stale, doesn't force immediate fetches
- Follow-up: targeted invalidation by queued challenge IDs can be added later via `succeededTypes` metadata on `ProcessQueueResult`

### Change 1: `useNetworkStatus.ts` -- add invalidation after reconnect

- Import `useQueryClient` + `invalidateAfterSync`
- Replace `.catch()` with `.then(result => invalidateAfterSync(result, queryClient)).catch(...)`
- Add `queryClient` to `useEffect` dep array (stable ref, no re-runs)

### Change 2: `useOfflineQueue.ts` -- add invalidation in both paths

- Import `useQueryClient` + `invalidateAfterSync`
- `enqueue`: `processQueue().then(result => invalidateAfterSync(result, queryClient)).catch(...)`
- `processNow`: `const result = await processQueue(); invalidateAfterSync(result, queryClient);`
- Update `useCallback` dep arrays to include `queryClient`

### Change 3: `app/_layout.tsx` -- add invalidation at startup

- Import `invalidateAfterSync`
- Add `const queryClient = useQueryClient()` in `RootLayoutNav`
- Replace `processQueue().catch(...)` with `.then(result => invalidateAfterSync(result, queryClient)).catch(...)`

### Change 4: `OfflineIndicator.tsx` -- switch to `useOfflineQueue` hook (**required**)

This is a **correctness path**, not an edge case:

- Manual sync tap calls `processQueue()` directly from Zustand store
- `useNetworkStatus` doesn't fire because there was no reconnection event
- Without this change, manual sync completes silently with stale caches

```typescript
// BEFORE
import { useOfflineStore } from "@/stores/offlineStore";
const processQueue = useOfflineStore((s) => s.processQueue);
onPress={() => processQueue()}

// AFTER
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
const { processNow, isProcessing, queueLength } = useOfflineQueue();
onPress={() => processNow()}
```

### Change 5: Update stale comments in `useChallenges.ts`

Update `onSettled` comments in both `useLogActivity` and `useLogWorkout`:
```typescript
// If queued, skip -- invalidation happens in useNetworkStatus/useOfflineQueue/
// _layout after processQueue() succeeds (M1: invalidateAfterSync)
```

---

## 5. Concurrency Design Note

The store's `isProcessing` guard (`offlineStore.ts` lines 252-262) returns `{ processed: 0, succeeded: 0, failed: 0, remaining: queue.length }` when a second caller enters `processQueue()` while the first is still running.

The `invalidateAfterSync` helper checks `result.succeeded > 0`, so the second caller sees `succeeded: 0` and skips invalidation. Only the first caller (which actually processed items) triggers invalidation.

**Duplicate invalidation is tolerated by design.** Even if two callers both trigger invalidation, the effect is idempotent -- it marks caches as stale, triggering a single refetch. There is no harmful side effect.

---

## 6. Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Over-invalidation: broad `challengeKeys.all` refreshes more than intended when multiple screens mounted | Low impact | React Query only refetches *mounted* queries. Follow-up: track queued challenge IDs for targeted invalidation. |
| Double invalidation: online path invalidates in `onSettled`, then `useOfflineQueue.enqueue` also invalidates | None | Online mutations return `{ queued: false }` -> `onSettled` runs specific invalidation. `processQueue()` returns `succeeded: 0` -> no broad invalidation fires. |
| `useQueryClient()` not available | None | All callsites render inside `QueryClientProvider` (verified in `_layout.tsx` tree). |
| Circular imports after moving query keys | None | `src/lib/queryKeys.ts` imports nothing from hooks or stores. `invalidateAfterSync.ts` imports from `queryKeys.ts` and type-only from `offlineStore`. |
| Future queue actions beyond activity/challenge | Low | `processQueue()` returns aggregate `succeeded` count without action types. Broad invalidation catches all cases but may become noisy. Future-proof with optional `succeededTypes` metadata if needed. |

---

## 7. Testing

### Unit tests: `src/lib/__tests__/invalidateAfterSync.test.ts`

**Behavioral tests** (mock `queryClient`, call helper directly):
- `succeeded > 0` -> returns `true`, calls `invalidateQueries` 2x
- `succeeded === 0` (empty queue) -> returns `false`, no calls
- `succeeded === 0` (all failed) -> returns `false`, no calls
- `succeeded === 0` (concurrent caller short-circuit) -> returns `false`, no calls
- Partial success (succeeded + failed) -> returns `true`, calls 2x

**Structural regression tests** (read source files, assert patterns):
- `useNetworkStatus.ts` contains `invalidateAfterSync` + `useQueryClient`
- `useOfflineQueue.ts` contains `invalidateAfterSync` + `useQueryClient`
- `_layout.tsx` contains `invalidateAfterSync`
- `OfflineIndicator.tsx` contains `useOfflineQueue` + `processNow`, does NOT contain `useOfflineStore.*processQueue`
- `useChallenges.ts` comments reference `M1`

### Manual verification

1. Enable airplane mode
2. Log an activity on a challenge
3. Verify optimistic update shows in UI
4. Disable airplane mode
5. **Without navigating away or refreshing:** verify challenge detail, leaderboard, and activity feed update with server data within a few seconds

---

## 8. Files Changed

| File | Type | Description |
|------|------|-------------|
| `src/lib/queryKeys.ts` | **NEW** | Centralized query key factories (challengeKeys, activityKeys, notificationsKeys, friendsKeys) |
| `src/lib/invalidateAfterSync.ts` | **NEW** | Shared cache invalidation helper with `succeeded > 0` guard |
| `src/lib/__tests__/invalidateAfterSync.test.ts` | **NEW** | 5 behavioral + 5 structural regression tests |
| `src/hooks/useChallenges.ts` | Modified | Re-export `challengeKeys` from `@/lib/queryKeys`, import others from same, update `onSettled` comments |
| `src/hooks/useActivities.ts` | Modified | Re-export `activityKeys` from `@/lib/queryKeys` |
| `src/hooks/useNotifications.ts` | Modified | Re-export `notificationsKeys` from `@/lib/queryKeys` |
| `src/hooks/useFriends.ts` | Modified | Re-export `friendsKeys` from `@/lib/queryKeys`, import `notificationsKeys` from `@/lib/queryKeys` |
| `src/hooks/useRealtimeSubscription.ts` | Modified | Import all keys from `@/lib/queryKeys` instead of individual hooks |
| `src/hooks/useNetworkStatus.ts` | Modified | Add `invalidateAfterSync` after reconnect `processQueue()` |
| `src/hooks/useOfflineQueue.ts` | Modified | Add `invalidateAfterSync` in `enqueue` and `processNow` |
| `app/_layout.tsx` | Modified | Add `invalidateAfterSync` after startup `processQueue()` |
| `src/components/OfflineIndicator.tsx` | Modified | Switch to `useOfflineQueue` hook's `processNow` |

---

## 9. Optional Hardening (Not in Scope)

### A. Targeted invalidation by queued challenge IDs

Track which challenge IDs are in the queue. After sync, invalidate only `challengeKeys.detail(id)` and `challengeKeys.leaderboard(id)`. Add telemetry to measure refetch burst after reconnect.

### B. `succeededTypes` metadata on `ProcessQueueResult`

`processQueue()` currently returns aggregate counts only. Adding `succeededTypes: string[]` (e.g., `["LOG_ACTIVITY", "ACCEPT_INVITE"]`) would let `invalidateAfterSync` selectively invalidate based on action type. Not required while the queue only handles activity-adjacent actions.

### C. Zustand `onQueueProcessed` callback

Optional callback on `processQueue()` for any caller (not just hooks) to react to sync completions. Deferred -- the hook approach covers all UI-triggered paths.

---

## 10. Definition of Done

- [ ] `src/lib/queryKeys.ts` created with all 4 key factories
- [ ] `src/lib/invalidateAfterSync.ts` created with shared helper
- [ ] Hook files re-export keys from `@/lib/queryKeys` (backward compat)
- [ ] `useNetworkStatus.ts` calls `invalidateAfterSync` after reconnect sync
- [ ] `useOfflineQueue.ts` calls `invalidateAfterSync` in both `enqueue` and `processNow`
- [ ] `app/_layout.tsx` calls `invalidateAfterSync` after startup sync
- [ ] `OfflineIndicator.tsx` uses `useOfflineQueue` hook's `processNow` (not direct store)
- [ ] `useChallenges.ts` comments updated in both `useLogActivity` and `useLogWorkout`
- [ ] No circular import issues (`lib/` does not import from `hooks/`)
- [ ] Unit tests pass: 5 behavioral + 5 structural
- [ ] Existing unit + integration tests pass (regression)
- [ ] SESSION-FINDINGS.md updated
- [ ] Committed (user-managed)

### Post-deploy validation

- Monitor reconnect-triggered refetch count (should see new invalidation events)
- Verify no excessive refetch bursts on reconnect (broad invalidation scope check)
- If action types expand beyond activity/challenge, revisit `succeededTypes` metadata
