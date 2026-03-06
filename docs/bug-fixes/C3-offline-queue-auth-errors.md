# C3. Offline Queue Retries Auth Failures as Transient

**Severity:** CRITICAL
**Files:** `src/stores/offlineStore.ts`, `src/hooks/useOfflineQueue.ts`
**Status:** IMPLEMENTED (v2 — revised with Codex feedback)
**Date:** 2026-03-06
**Cross-ref:** Plan item C3, Codex audit confirmed

### Implementation Summary (v2 additions from Codex review)

1. **Cross-account replay prevention** — `queuedByUserId` captured at enqueue time, verified at process time. Mismatched items dropped before `executeAction` runs.
2. **403 classification documented** — `isAuthError()` intentionally covers both 401 (authentication) and 403 (authorization/RLS). Both are non-retryable in queue context.
3. **`isProcessing` try/finally hardening** — Processing body wrapped so `isProcessing` always resets, even on unexpected errors.
4. **Tests:** 30 total (14 existing + 16 new C3 tests). All passing.

---

## 1. Problem Statement

When the offline write queue processes a queued action and encounters an **authentication error** (expired JWT, revoked session, signed-out user), the error is treated as a transient failure and retried up to 5 times before being silently dropped. Auth errors are **never** transient — if the user's session is invalid, every retry will fail identically.

### Impact

| Scenario | Current behavior | Correct behavior |
|----------|-----------------|-------------------|
| User signs out while items are queued | Queue retries 5x on next reconnect, all fail, items silently dropped | Queue detects auth error, immediately drops items, logs clearly |
| JWT expires mid-queue-processing | `requireUserId()` may pass (cached), RPC fails with 401/PGRST301; item retried 5x | Auth error detected on RPC response, item immediately dropped |
| User switches accounts (C1 + C3 overlap) | Old user's queued actions run under new user's session OR fail with auth errors and retry 5x | Auth errors immediately dropped; queue should be cleared on sign-out regardless (defense-in-depth) |
| Network reconnect after long offline period | Queue fires on reconnect, all items fail with expired JWT, retry storm | Single attempt per item, auth failure detected, all items dropped immediately |

### Why this is CRITICAL

1. **Retry storm on reconnect:** The `useNetworkStatus` hook triggers `processQueue()` when connectivity is restored. If the user was offline long enough for their JWT to expire, every queued item fails 5x = `N * 5` wasted API calls.
2. **Silent data loss:** After 5 retries, items are silently removed. The user has no indication their activity logs, invite acceptances, or friend requests were permanently lost.
3. **Cross-account interaction with C1:** If the security store is reset (C1 fix) but the offline queue is NOT cleared on sign-out, old user's queued items could attempt execution under the new user's session — or fail with auth errors and retry 5x.

---

## 2. Root Cause Analysis

### Current error handling (lines 218-247)

```typescript
// processQueue() catch block — current code
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // GUARDRAIL 3: Retry limits
  if (item.retryCount + 1 >= MAX_RETRIES) {
    toRemove.push(item.id);
    failed++;
    console.error(/* ... */);
  } else {
    toUpdate.push({
      ...item,
      retryCount: item.retryCount + 1,
      lastError: errorMessage.substring(0, 200),
    });
    failed++;
    console.warn(/* ... */);
  }
}
```

**The problem:** There is no classification of the error type. Every error — whether it's a transient network timeout or a permanent auth failure — enters the same retry path. The only exit is exhausting `MAX_RETRIES` (5).

### Auth error sources in `executeAction()`

There are **two points** where auth errors can originate:

1. **`requireUserId()` (line 103, 121, 134)** — calls `supabase.auth.getUser()` which does a server round-trip. Throws:
   - `AuthError` if the session is invalid/expired
   - `Error("Authentication required")` if no user exists

2. **Supabase RPC/query calls (lines 105-116, 123-129, 136-143)** — the HTTP request carries the JWT. If it's expired mid-flight, Supabase returns:
   - HTTP 401 with `PGRST301` (JWT expired) or `PGRST302` (JWT invalid)
   - HTTP 403 with RLS/permission errors

### Existing auth error patterns in the codebase

The codebase already has well-established auth error detection in **`src/lib/queryRetry.ts`**:

```typescript
// Non-retryable codes (queryRetry.ts lines 8-24)
"PGRST301"  // JWT expired
"PGRST302"  // JWT invalid
"42501"     // insufficient_privilege

// Non-retryable HTTP status (queryRetry.ts lines 29-36)
401  // Unauthorized
403  // Forbidden

// Non-retryable message patterns (queryRetry.ts lines 41-53)
/jwt expired/i
/jwt invalid/i
/invalid.*token/i
/authentication required/i
/permission denied/i
```

And in **`src/lib/sentry.ts`** (lines 11-17):

```typescript
/jwt expired/i
/jwt invalid/i
/invalid.*token/i
/authentication required/i
/not authenticated/i
```

---

## 3. Proposed Fix

### 3a. Add `isAuthError()` classifier to offlineStore.ts

Add a private function that detects auth-related errors. This is deliberately **narrower** than `queryRetry.shouldRetryError()` — we only want to short-circuit on clear authentication failures, not all non-retryable errors. Constraint violations (23505) are already handled as idempotent successes in `executeAction()`.

```typescript
// Add below the CONSTANTS section (~line 82), before ACTION EXECUTOR

// =============================================================================
// AUTH ERROR DETECTION
// =============================================================================

/**
 * Check if an error indicates authentication failure.
 *
 * Auth errors are non-retryable — the user's session is invalid and
 * retrying will produce the same failure. Items hitting this path are
 * removed immediately instead of burning through MAX_RETRIES.
 *
 * Patterns sourced from:
 *   - src/lib/queryRetry.ts (NON_RETRYABLE_CODES, NON_RETRYABLE_PATTERNS)
 *   - src/lib/sentry.ts (IGNORED_ERROR_PATTERNS)
 */
function isAuthError(error: unknown): boolean {
  // Extract structured fields (Supabase/PostgREST errors)
  const err = error as Record<string, unknown> | null;
  const code = typeof err?.code === "string" ? err.code : "";
  const status = typeof err?.status === "number"
    ? err.status
    : typeof err?.statusCode === "number"
      ? err.statusCode
      : 0;
  const message = error instanceof Error
    ? error.message
    : typeof err?.message === "string"
      ? err.message
      : String(error);

  // PostgREST JWT error codes
  if (code === "PGRST301" || code === "PGRST302") return true;

  // HTTP 401 Unauthorized / 403 Forbidden
  if (status === 401 || status === 403) return true;

  // Message patterns (case-insensitive)
  if (/jwt expired/i.test(message)) return true;
  if (/jwt invalid/i.test(message)) return true;
  if (/authentication required/i.test(message)) return true;
  if (/not authenticated/i.test(message)) return true;
  if (/invalid.*token/i.test(message)) return true;
  if (/permission denied/i.test(message)) return true;
  if (/insufficient.privilege/i.test(message)) return true;

  return false;
}
```

### 3b. Modify catch block in `processQueue()` to short-circuit on auth errors

Replace the existing catch block with auth-error detection before the retry-count check:

```typescript
// processQueue() catch block — AFTER fix
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // C3 FIX: Auth errors are non-retryable — drop immediately
  // instead of burning through MAX_RETRIES with identical failures.
  if (isAuthError(error)) {
    toRemove.push(item.id);
    failed++;

    // GUARDRAIL 6: No tokens in logs
    console.error(
      `[OfflineQueue] Auth error — dropping immediately:`,
      item.action.type,
      item.id,
      errorMessage.substring(0, 100),
    );
  } else if (item.retryCount + 1 >= MAX_RETRIES) {
    // GUARDRAIL 3: Retry limits (transient errors only)
    toRemove.push(item.id);
    failed++;

    // GUARDRAIL 6: Don't log full error which might contain tokens
    console.error(
      `[OfflineQueue] Failed permanently after ${MAX_RETRIES} retries:`,
      item.action.type,
      item.id,
      errorMessage.substring(0, 100),
    );
  } else {
    toUpdate.push({
      ...item,
      retryCount: item.retryCount + 1,
      lastError: errorMessage.substring(0, 200),
    });
    failed++;

    console.warn(
      `[OfflineQueue] Retry ${item.retryCount + 1}/${MAX_RETRIES}:`,
      item.action.type,
      item.id,
    );
  }
}
```

### 3c. Export `isAuthError` for testing (named export)

```typescript
// Add at end of file, after offlineStoreSelectors
// Exported for unit tests only
export { isAuthError as _isAuthError };
```

This follows the underscore-prefix convention for test-only exports, keeping it clear that `isAuthError` is an internal implementation detail.

---

## 4. Placement Rationale

### Why `isAuthError()` lives in offlineStore.ts, not queryRetry.ts

| Consideration | Decision |
|---------------|----------|
| `queryRetry.ts` has `shouldRetryError()` which already covers auth | `shouldRetryError` is designed for React Query's retry semantics. It also flags constraint violations, "not found", and other errors as non-retryable. The offline queue already handles constraint violations (23505) as idempotent successes in `executeAction()`. Using `shouldRetryError` here would create unexpected interactions. |
| Reuse vs. precision | A narrow `isAuthError()` is the right tool. It detects exactly what C3 is about: the user's session is gone. Network errors, constraint errors, and other failures correctly stay in the retry path. |
| Future refactoring | If more consumers need auth detection, `isAuthError()` can be extracted to a shared `src/lib/errorClassification.ts`. For now, co-locating with its only consumer is cleaner. |

### Why the check is in `processQueue()`, not `executeAction()`

`executeAction()` is responsible for **executing** the action and throwing on failure. Error classification is a **processing concern** — it determines what happens next (retry vs. drop). Keeping this separation makes `executeAction()` simpler and testable in isolation.

---

## 5. Correctness Analysis

### Error classification matrix

| Error source | Error shape | `isAuthError()` returns | Queue behavior (after fix) |
|---|---|---|---|
| `requireUserId()` — no session | `Error("Authentication required")` | `true` | Drop immediately |
| `requireUserId()` — expired JWT | `AuthError { message: "JWT expired" }` | `true` | Drop immediately |
| Supabase RPC — 401 | `{ status: 401, code: "PGRST301", message: "JWT expired" }` | `true` | Drop immediately |
| Supabase RPC — 403 (RLS) | `{ status: 403, message: "permission denied..." }` | `true` | Drop immediately |
| Supabase query — PGRST302 | `{ code: "PGRST302", message: "JWT invalid" }` | `true` | Drop immediately |
| Network timeout | `Error("ETIMEDOUT")` | `false` | Retry (up to 5x) |
| Network disconnected | `TypeError("Network request failed")` | `false` | Retry (up to 5x) |
| Supabase 500 | `{ status: 500, message: "internal server error" }` | `false` | Retry (up to 5x) |
| Duplicate key (23505) | Not reached — handled in `executeAction()` as success | N/A | Already succeeds |

### Edge case: partial auth failure in mixed queue

Scenario: Queue has 3 items. Item 1 succeeds, item 2 fails with auth error (JWT just expired), item 3 also fails with auth error.

- **Before fix:** Items 2 and 3 get retryCount++, stay in queue, retry 4 more times each.
- **After fix:** Items 2 and 3 immediately removed. Result: `{ processed: 3, succeeded: 1, failed: 2, remaining: 0 }`.

### Edge case: auth error on first-ever attempt

Item with `retryCount: 0` fails with auth error.

- **Before fix:** retryCount becomes 1, item stays in queue.
- **After fix:** Item immediately removed. `isAuthError()` check happens **before** the retry-count check.

### Defense-in-depth with C1

The C1 fix clears the security store on sign-out, but the **offline queue is not cleared** on sign-out. Should it be?

| Approach | Trade-off |
|----------|-----------|
| Clear queue on sign-out (nuclear option) | Prevents any old-user items from running, but loses legitimately queued work if the user quickly signs back in to the same account |
| Keep queue, rely on C3 auth detection | Items fail fast on first attempt if user is signed out. If same user signs back in quickly, items succeed. Best of both worlds. |

**Recommendation:** C3 (auth detection) is sufficient. Clearing the queue on sign-out is an optional enhancement that can be layered on later if needed.

---

## 6. Test Plan

### New tests for C3 (`src/stores/__tests__/offlineStore.test.ts`)

Tests will be added to the existing `offlineStore.test.ts` file in a new `describe("auth error handling (C3)")` block.

#### 6a. `isAuthError` classification tests

```
- identifies "Authentication required" (from requireUserId)
- identifies "JWT expired" message
- identifies "JWT invalid" message
- identifies PGRST301 error code
- identifies PGRST302 error code
- identifies HTTP 401 status
- identifies HTTP 403 status
- identifies "permission denied" message
- identifies "not authenticated" message
- does NOT flag network errors (ETIMEDOUT, network request failed)
- does NOT flag server errors (500, internal server error)
- does NOT flag constraint errors (23505, duplicate key)
```

#### 6b. Queue processing with auth errors

```
- drops item immediately on auth error from requireUserId
- drops item immediately on auth error from RPC (401)
- drops item immediately on auth error (JWT expired message)
- does NOT burn retries — item removed on first auth failure (retryCount: 0)
- mixed queue: auth error items dropped, network error items retained for retry
- auth error on item with existing retryCount still drops immediately (not based on count)
- result correctly reflects auth-dropped items in failed + remaining counts
```

#### 6c. Existing tests remain unchanged

All 18 existing tests continue to pass. The new tests are additive — they validate the new auth-error path without modifying existing retry/success/idempotency behavior.

### Test approach: mock configuration

Auth errors will be simulated by configuring the existing `requireUserId` and `mockRpc` mocks:

```typescript
// Simulate requireUserId throwing auth error
const { requireUserId } = jest.requireMock("@/lib/supabase");
requireUserId.mockRejectedValueOnce(new Error("Authentication required"));

// Simulate RPC returning 401
mockRpc.mockResolvedValueOnce({
  error: { status: 401, code: "PGRST301", message: "JWT expired" },
});

// Simulate RPC returning 403 permission error
mockRpc.mockResolvedValueOnce({
  error: { status: 403, message: "permission denied for table challenge_participants" },
});
```

---

## 7. Files Changed

| File | Change type | Description |
|------|-------------|-------------|
| `src/stores/offlineStore.ts` | Modified | Add `isAuthError()` function; modify `processQueue()` catch block to short-circuit on auth errors |
| `src/stores/__tests__/offlineStore.test.ts` | Modified | Add ~19 new tests for auth error classification and queue processing behavior |

---

## 8. Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `isAuthError()` false positive — legitimate transient error classified as auth | Low | Patterns are specific and match 3 existing sources (queryRetry, sentry, requireUserId). No overlap with network error patterns. |
| `isAuthError()` false negative — auth error not detected | Low | Covers all known error shapes from `requireUserId()` and Supabase API. Unknown shapes fall through to existing retry logic (safe default). |
| Breaking existing retry behavior | None | Auth check is added BEFORE the existing retry-count check. Non-auth errors follow the identical path as before. |
| `ProcessQueueResult` semantics change | None | Auth-dropped items are counted in `failed` and reflected in `remaining`, same as items dropped after MAX_RETRIES. No interface change needed. |

---

## 9. Architectural Notes

- **Pattern alignment:** `isAuthError()` uses the same error patterns as `queryRetry.ts` and `sentry.ts`, ensuring consistency across the codebase's error classification layers.
- **Guardrail compliance:** GUARDRAIL 3 (retry limits) and GUARDRAIL 6 (no tokens in logs) are preserved. The auth-error log message uses the same truncation (`substring(0, 100)`) as existing error logs.
- **No public API changes:** `ProcessQueueResult`, `QueuedItem`, `QueuedAction`, and all store actions remain unchanged. The fix is entirely internal to the processing logic.
- **Observable via logs:** Auth-error drops produce a distinct log message (`Auth error — dropping immediately`) distinguishable from retry-exhaustion drops (`Failed permanently after 5 retries`), enabling diagnosis from crash reporting.
