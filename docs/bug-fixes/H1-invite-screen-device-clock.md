# H1. Invite Screen Uses Device Clock for Date Math

**Severity:** HIGH
**File:** `app/invite/[id].tsx` lines 123-130
**Status:** IMPLEMENTED
**Date:** 2026-03-06
**Cross-ref:** Plan item H1

---

## 1. Problem Statement

The `getDaysUntilStart()` function in the invite detail screen uses `new Date()` (device clock) to calculate how many days until a challenge starts:

```typescript
const getDaysUntilStart = (startDate: string) => {
  const start = new Date(startDate);
  const now = new Date();  // <-- BUG: device clock
  const diff = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return "Starting soon";
  if (diff === 1) return "Starts tomorrow";
  return `Starts in ${diff} days`;
};
```

The rest of the app uses `getServerNow()` from `src/lib/serverTime.ts` for all time-relative calculations. This function accounts for device clock drift by applying a cached offset synced from the server's `get_server_time()` RPC.

### Impact

| Scenario | Current behavior | Correct behavior |
|----------|-----------------|-------------------|
| Device clock is 2 days ahead | Shows "Starting soon" for a challenge starting tomorrow | "Starts tomorrow" |
| Device clock is 1 day behind | Shows "Starts in 3 days" for a challenge starting in 2 days | "Starts in 2 days" |
| Device clock is correct | Works correctly by coincidence | Works correctly by design |

The invite screen is often the first impression a user has of a challenge. Showing incorrect timing here could cause a user to decline an invite they'd otherwise accept (thinking it already started) or accept without urgency (thinking they have more time than they do).

---

## 2. Root Cause

The `getDaysUntilStart` function was written as a local helper without awareness of the `serverTime` module. The codebase already has `formatStartsIn()` — a convenience wrapper around `formatTimeUntil()` — which does the same thing but:

1. Uses `getServerNow()` instead of `new Date()`
2. Has finer granularity (hours, minutes for near-term challenges)
3. Is already used in `StartingSoonCard.tsx` and other components

---

## 3. Fix Applied

Replaced `getDaysUntilStart` with `formatStartsIn` from `@/lib/serverTime`.

### Copy/UX Changes (intentional)

This is both a bug fix AND a deliberate copy change. The new formatter provides richer, more accurate messaging:

| Scenario | Old copy | New copy | Notes |
|----------|----------|----------|-------|
| Already started / < 1 min | "Starting soon" | "Starts now" | More accurate |
| Starts in 45 min | "Starts tomorrow" (wrong!) | "Starts in 45 min" | Bug fix — old code ceil'd to 1 day |
| Starts in 3 hours | "Starts tomorrow" (wrong!) | "Starts in 3 hours" | Bug fix — old code ceil'd to 1 day |
| Starts in 25 hours | "Starts in 2 days" (wrong!) | "Starts tomorrow" | Bug fix — old code ceil'd to 2 days |
| Starts in 5 days | "Starts in 5 days" | "Starts in 5 days" | No change |

### Behavior before first sync

`getServerNow()` falls back to `new Date()` (device time) if sync hasn't happened yet. This means pre-sync behavior is identical to the old code. After `syncServerTime()` fires (triggered on auth in `AuthProvider.tsx`), the offset is applied. No degradation possible.

### Invalid date handling

Both old and new code parse dates via `new Date(dateString)`. The API contract guarantees ISO 8601 dates from Supabase `timestamptz` columns. If a malformed date somehow arrives, `formatTimeUntil` produces "Starts now" (NaN diff falls into the `<= nowThreshold` branch), which is acceptable degradation.

---

## 4. Files Changed

| File | Change type | Description |
|------|-------------|-------------|
| `app/invite/[id].tsx` | Modified | Import `formatStartsIn`, remove `getDaysUntilStart`, update one call site |

---

## 5. Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| UI text changes slightly | Expected | `formatStartsIn` output is richer (hours/minutes), all improvements |
| `formatStartsIn` fails if server time not synced | None | Falls back to device time gracefully (`getServerNow` returns `new Date()` if no sync) |
| Breaking existing tests | None | No tests exist for invite screen date display |
| Copy change surprises users | Low | All changes are more informative than the old copy |

---

## 6. Testing

`formatStartsIn` is already comprehensively tested in `src/lib/__tests__/serverTime.test.ts` (sync logic, granularity branches, edge cases). The server time sync pipeline is integration-tested in `activity.server-time.integration.test.ts`.

This change is a one-line call-site swap to an already-tested utility. No additional tests needed — the invite screen rendering itself is best verified via manual QA (skewed device clock scenario).
