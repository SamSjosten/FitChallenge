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
- 16 new tests added (30 total in offlineStore.test.ts)

---

## Template for New Findings

### FX. [Title]
- **File:**
- **Severity:**
- **Context:**
- **Recommended fix:**
- **Status:** Deferred / Fixed / In Progress
