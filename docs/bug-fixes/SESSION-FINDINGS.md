# Session Findings — Living Document

**Session date:** 2026-03-06
**Purpose:** Tracks new issues discovered during bug fix implementation that were not in the original review.

---

## Discovered During C1 Implementation

### F1. Direct `profiles` write in AuthProvider (Rule 20 violation)
- **File:** `src/providers/AuthProvider.tsx` lines 547-550
- **Severity:** MEDIUM
- **Rule violated:** CLAUDE_SYSTEM_RULES Rule 20 — "UI components must not perform direct database writes. All writes must go through a service function or RPC."
- **Code:**
  ```typescript
  await getSupabaseClient()
    .from("profiles")
    .update({ display_name: appleDisplayName })
    .eq("id", session.user.id);
  ```
- **Context:** Apple Sign-In display name capture. Apple only provides the name on first authorization, so it's applied immediately after profile creation. The write is self-only (`.eq("id", session.user.id)`) so no privacy violation, but it bypasses the service layer.
- **Recommended fix:** Move to `authService.updateDisplayName(userId, name)` or similar service method.
- **Status:** Deferred

### F2. `src/types/database.ts` was empty (accidental deletion)
- **File:** `src/types/database.ts`
- **Severity:** CRITICAL (build-breaking)
- **Cause:** Commit `3406933` ("Add workout activity classification") accidentally emptied the file (1,140 lines deleted, 0 added).
- **Fix applied:** Restored from `6e0c0ca` (last good version). File now has 1,140 lines with all types intact.
- **Cross-ref:** Codex audit finding A2.
- **Status:** Fixed

---

## Discovered During C3 Implementation

No new findings. C3 implementation was clean — all changes aligned with existing patterns in `queryRetry.ts` and `sentry.ts`.

**C3 implementation notes:**
- Added `queuedByUserId` to `QueuedItem` (backward-compatible, optional field)
- `useOfflineQueue` hook now imports `useAuth` to capture userId at enqueue time
- `isAuthError()` classifier added to `offlineStore.ts` (private, not exported)
- `processQueue()` wrapped in try/finally for `isProcessing` resilience
- 16 new unit tests added (30 total in offlineStore.test.ts)
- 15 integration tests added in `offline-queue.integration.test.ts` — all against real Supabase test DB:
  - Happy path: LOG_ACTIVITY, ACCEPT_INVITE, SEND_FRIEND_REQUEST, idempotency (4 tests)
  - Cross-account guard: mismatch drop, same-user process, legacy items (3 tests)
  - Auth error handling: pre-loop deferral, real PostgREST error shape, invalid JWT drop, business error retry (4 tests)
  - Mixed queue accounting (1 test)
  - isProcessing resilience (3 tests)

---

## Discovered During H1 Implementation

No new findings. H1 was a one-file, three-line change — import `formatStartsIn`, delete `getDaysUntilStart`, swap call site.

**H1 implementation notes:**
- Removed `getDaysUntilStart()` local helper (lines 123-130) which used `new Date()` (device clock)
- Replaced with `formatStartsIn()` from `@/lib/serverTime` which uses `getServerNow()` (server-adjusted clock)
- Copy changes are intentional: finer granularity (hours/minutes), "Starting soon" → "Starts now"
- No new tests needed — `formatStartsIn` already covered by 52 tests in `serverTime.test.ts`

---

## Discovered During H2 Implementation

No new findings. H2 was a structural refactor — split `isNavigationLocked()` into pure read + `clearStaleLock()` mutation.

**H2 implementation notes:**
- `isNavigationLocked()` no longer calls `set()` — safe to call during React render
- New `clearStaleLock()` action performs the stale-lock mutation
- `useProtectedRoute.ts` calls `clearStaleLock()` in useEffect before checking lock
- AppState listener calls `clearStaleLock()` instead of `isNavigationLocked()`
- `_layout.tsx` render call unchanged — now inherently safe
- 15 unit tests added in `src/stores/__tests__/navigationStore.test.ts`:
  - setAuthHandlingNavigation lifecycle (5 tests)
  - isNavigationLocked purity — pure read, no side effects (5 tests)
  - clearStaleLock mutation action (4 tests)
  - CQS contract regression test — proves the original bug is fixed (1 test)
- Unit tests justified: navigation store is a pure client-side Zustand state machine with zero Supabase/network interaction
- Only mocks: `react-native` AppState (platform module) and `Date.now()` (deterministic timing)

---

## Discovered During H4 Implementation

No new findings. H4 was a targeted fix — wrapping `disableCurrentToken()` in `withAuth()` and adding `.eq("user_id", userId)`.

**H4 implementation notes:**
- `disableCurrentToken()` now uses `withAuth()` for explicit auth check + userId injection
- Query scoped by `(user_id, token)` — defense-in-depth alongside RLS
- JSDoc documents best-effort sign-out race semantics
- Two-tier test coverage:
  - 4 integration tests (live Supabase): self-disable, cross-user isolation with shared token, RLS safety net proof, non-existent token no-op
  - 6 unit tests (service orchestration): happy path, userId passthrough, early exits (non-device, no token), DB error warning, auth error graceful catch
- All 13 push token integration tests pass (9 existing + 4 new)

---

## Discovered During H5 Implementation

No new findings. H5 was a mechanical 3-site change — replacing constant retry delay with exponential backoff.

**H5 implementation notes:**
- `RETRY_DELAY_MS = 1000` → `RETRY_BASE_MS = 500` with `RETRY_BASE_MS * Math.pow(2, attempt - 1)`
- All 3 retry sites updated identically (not-found at line 223, null-data at line 242, timeout at line 263)
- Log messages now show computed delay instead of constant
- JSDoc updated: "with a delay" → "with exponential backoff (500ms, 1s)"
- Delay schedule: attempt 1→2 = 500ms, attempt 2→3 = 1000ms (was 1000ms, 1000ms)
- No new tests — mechanical formula swap, correctness self-evident from code
- All 71 store unit tests + 6 pushTokens service tests pass (regression check)

---

## Discovered During M1 Implementation

**M1: Queued activity skips cache invalidation permanently**

Found a **4th caller** of `processQueue()` that was missed in initial investigation: `app/_layout.tsx` line 151 (startup with pending items). This path was fire-and-forget with no invalidation, same as the other 3.

**Key architectural decision:** moved all query key factories (`challengeKeys`, `activityKeys`, `notificationsKeys`, `friendsKeys`) from individual hook files to `src/lib/queryKeys.ts` to prevent hook-to-hook import coupling. Hooks re-export for backward compatibility.

**M1 implementation notes:**
- Created `src/lib/queryKeys.ts` — centralized query key factories (pure data, no React deps)
- Created `src/lib/invalidateAfterSync.ts` — shared helper with `succeeded > 0` guard
- Wired invalidation at all 4 `processQueue()` callsites: `useNetworkStatus`, `useOfflineQueue` (2 paths), `_layout.tsx`
- Switched `OfflineIndicator.tsx` from direct store `processQueue()` to `useOfflineQueue` hook's `processNow` (correctness path, not optional)
- Updated stale `onSettled` comments in `useChallenges.ts` (both `useLogActivity` and `useLogWorkout`)
- 5 hook files updated for query key re-exports (useChallenges, useActivities, useNotifications, useFriends, useRealtimeSubscription)
- 6 behavioral + 5 structural regression unit tests
- Concurrency is safe: store's `isProcessing` guard returns `succeeded: 0` for second caller

---

## Template for New Findings

### FX. [Title]
- **File:**
- **Severity:**
- **Context:**
- **Recommended fix:**
- **Status:** Deferred / Fixed / In Progress
