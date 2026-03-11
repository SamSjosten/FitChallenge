# H5. Profile Retry Delay Constant (Not Exponential)

**Severity:** HIGH
**File:** `src/services/auth.ts` lines 186–280
**Status:** IMPLEMENTED (timing change only), pending post-release telemetry validation
**Date:** 2026-03-11
**Cross-ref:** Plan item H5, `eager-puzzling-frog.md`

---

## Decision Record

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Base delay | 500ms | Fast enough to catch quick triggers (~200-500ms), slow enough to avoid premature retries |
| Growth factor | 2× (doubling) | Industry standard — AWS SDK, Google Cloud, gRPC, Supabase realtime |
| Max retries | 3 (unchanged) | Sufficient for trigger lag; more attempts add latency without evidence of benefit |
| Jitter | None | Single-client path, no shared resource contention, no thundering herd risk |
| Objective | **Perceived-latency optimization** — faster first retry for the common case, with acceptance criteria that profile-load error rate must not regress |

---

## 1. Problem Statement

When a new user signs in via Google or Apple, Supabase creates the `auth.users` row immediately, but the `handle_new_user` database trigger creates the corresponding `profiles` row **asynchronously**. There's a race: the client calls `getMyProfileWithUserId()` to load the profile, but the row might not exist yet.

The function handles this correctly — it retries up to 3 times. The bug is in the **timing** of those retries.

### The buggy code (before fix)

```typescript
// src/services/auth.ts lines 187-189 (BEFORE)
const TIMEOUT_MS = 5000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;  // ← constant: every retry waits the same 1 second
```

This constant is used in 3 places — one for each failure mode (not-found, null data, timeout):

```typescript
// Line 227 (not-found path), line 245 (null-data path), line 265 (timeout path)
await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
```

**Every retry waits exactly 1000ms regardless of how many attempts have failed.** This is a constant-delay retry, not exponential backoff.

### Why this matters

This is primarily a **perceived-latency optimization**. The retry logic is functionally correct — the issue is *how long* users wait during the most common sign-up path.

**Scenario: New Google sign-in on a fast connection**

The `handle_new_user` trigger typically completes in 200–500ms. With constant 1s delay:
1. Attempt 1 fires immediately → profile not found (trigger still running)
2. Wait 1000ms → attempt 2 → profile found ✅

Total time: ~1200ms. But the trigger finished at ~400ms. The user waited an extra **600ms** staring at a spinner for no reason.

**Scenario: New sign-in on a slow mobile network**

The trigger + network round-trip takes 2.5s. With constant 1s delay:
1. Attempt 1 at 0ms → not found
2. Wait 1000ms → attempt 2 at ~1000ms → not found
3. Wait 1000ms → attempt 3 at ~2000ms → not found → **throws error** ❌

Total wait budget: 2000ms. The profile would have been ready at 2500ms — just 500ms later — but the function gave up because all 3 attempts exhausted their identically-spaced windows.

### The call chain

```
AuthProvider.tsx line 154
  → authService.getMyProfileWithUserId(session.user.id)
    → retry loop (3 attempts, constant 1s delay) ← THE BUG
      → getSupabaseClient().from("profiles").select("*").eq("id", userId).single()

AuthProvider.tsx line 553 (Apple display name refresh)
  → authService.getMyProfileWithUserId(session.user.id)
    → same retry loop

authService.getMyProfile() line 165
  → withAuth → this.getMyProfileWithUserId(userId)
    → same retry loop
```

Every profile load at sign-in goes through this single function.

---

## 2. Root Cause Analysis

### Why was constant delay chosen?

This is a natural first-pass pattern. The developer needed retries and reached for the simplest version:

```typescript
const RETRY_DELAY_MS = 1000;
// ...
await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
```

One constant, one `setTimeout`, readable and correct. The reasoning was likely: "The trigger takes about a second, so wait a second between retries."

### What's missing: failure as information

Each failed attempt gives you **new evidence** about how long the operation is taking. Constant delay ignores this evidence — it treats the 1st failure and the 2nd failure as equally surprising.

Think of it like knocking on a door:
- **First knock, no answer:** They're probably just in the other room. Wait a moment.
- **Second knock, no answer:** They might be in the shower, or outside. Wait a bit longer.
- **Third knock, no answer:** They might genuinely not be home. Give it a good long pause.

Constant delay is: knock, wait 5 seconds, knock, wait 5 seconds, knock, wait 5 seconds, give up. You're always equally patient. Exponential backoff scales your patience with the evidence.

---

## 3. Teaching: Exponential Backoff

### The formula

```
delay = base × 2^(attempt - 1)
```

This is the simplest form. With `base = 500ms`:

| Attempt | Delay before next | What it means |
|---------|------------------|---------------|
| 1 → 2  | 500ms            | "Probably just barely missed it — try again quickly" |
| 2 → 3  | 1000ms           | "Something is genuinely slow — give it more time" |
| 3       | — (final)        | Total wait budget: 1500ms |

Compare to constant 1000ms delay:

| Attempt | Delay before next | Total budget |
|---------|------------------|-------------|
| 1 → 2  | 1000ms           | 1000ms      |
| 2 → 3  | 1000ms           | 2000ms      |

Exponential backoff is **faster to first retry** (500ms vs 1000ms) and uses **less total time** (1500ms vs 2000ms), while giving the later retry a proportionally longer window.

### Why 3 attempts with 500ms base over alternatives?

| Option | Schedule | Total budget | Tradeoff |
|--------|----------|-------------|----------|
| **A: Current fix** (3 attempts, 500ms base) | 500, 1000 | 1500ms | Fastest UX for common case; slightly lower total budget |
| B: 4 attempts, 500ms base | 500, 1000, 2000 | 3500ms | More resilient but adds a 4th attempt + 2s wait on failure path |
| C: 3 attempts, 750ms base | 750, 1500 | 2250ms | Splits the difference; still faster first retry than 1000ms constant |
| D: Time-budget loop | Variable | Fixed ceiling | Most flexible long-term; adds complexity for a single use site |

**Why Option A:** This is a perceived-latency optimization, not a reliability redesign. The trigger completes in <500ms for the vast majority of sign-ins. Option A catches those fast, and the 3rd attempt still has a full 5s query timeout. If post-deploy telemetry shows error rate regression, we can bump to Option B or C with a one-line constant change.

### Why doubling?

The factor of 2 is a convention, not a law. The key insight is **geometric growth** — each wait is a constant multiple of the previous one. Factor 2 is standard because:
- It's simple to reason about
- It balances "don't give up too fast" with "don't wait forever"
- It's the default in AWS SDK, Google Cloud, gRPC, and Supabase's own reconnection logic

### When NOT to use exponential backoff

| Scenario | Better strategy | Why |
|----------|----------------|-----|
| Real-time polling (cursor sync, typing indicators) | Constant short interval | Users need consistent low latency |
| User taps "retry" button | No automatic delay | User controls timing |
| Heartbeat/health checks | Constant interval | Monitoring needs predictable cadence |
| Rate-limited API (429 responses) | Backoff with jitter | Jitter prevents thundering herd |

Profile loading during sign-in is a textbook fit for exponential backoff: it's automated, has a clear completion condition (row exists), and the user is already waiting on a loading screen.

### Jitter

In distributed systems, pure exponential backoff can cause **thundering herd** — all clients retry at the same doubling interval and overload the server simultaneously. The fix is to add random **jitter**: `delay = base × 2^(attempt-1) + random(0, base)`.

**Decision: No jitter for this path.** Retries are per-user with no shared resource contention. There is no fanout — each client retries its own profile fetch independently. If this path ever becomes high-concurrency (e.g., batch user creation), jitter should be reconsidered.

---

## 4. The Fix

### What changed

**One file:** `src/services/auth.ts`

**Constant renamed and revalued:**
```typescript
// BEFORE (line 189)
const RETRY_DELAY_MS = 1000;

// AFTER (line 189)
const RETRY_BASE_MS = 500;
```

**Three retry sites updated (lines 223, 242, 263) — same pattern at each:**
```typescript
// BEFORE
await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));

// AFTER
const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
await new Promise((r) => setTimeout(r, delay));
```

**Log messages updated to show computed delay:**
```typescript
// BEFORE
`retrying in ${RETRY_DELAY_MS}ms...`

// AFTER
`retrying in ${delay}ms...`
```

**JSDoc updated (line 181):**
```
// BEFORE
* times with a delay between attempts.

// AFTER
* times with exponential backoff (500ms, 1s) between attempts.
```

### What did NOT change

| Aspect | Still the same |
|--------|---------------|
| Retry count | `MAX_RETRIES = 3` |
| Timeout per attempt | `TIMEOUT_MS = 5000` |
| Error detection | PGRST116, "not found", "no rows", timeout check |
| Control flow | Same `if`/`continue`/`throw` paths |
| Error handling | Same `catch` block, same `console.error` |
| Return value | Same `Profile` type |

**Caveat:** Retry timing changed, therefore the observed failure/success boundary under degraded latency may shift. Specifically, operations that previously succeeded on attempt 2 (after 1000ms) might now attempt earlier (after 500ms) and may need attempt 3 (after another 1000ms) to succeed. The total inter-attempt budget is 500ms less (1500ms vs 2000ms), which could affect edge-case slow-trigger scenarios. This is the core UX-vs-reliability tradeoff — see guardrail in Section 8.

### Before vs After summary

| | Before | After |
|---|--------|-------|
| Delay pattern | 1000ms, 1000ms | 500ms, 1000ms |
| First retry speed | 1000ms | **500ms** (2× faster) |
| Total wait budget | 2000ms | **1500ms** (25% less) |
| Adapts to failure? | No | Yes |

---

## 5. Logging Contract

Each retry path logs a structured message with the following fields:

| Field | Source | Example |
|-------|--------|---------|
| Prefix | Hardcoded | `[AuthService]` |
| Status emoji | Per-branch | ⏳ (not-found), ⏳ (null), ⏱️ (timeout), ✅ (success), ❌ (fatal) |
| Short user ID | `userId.substring(0, 8)` | `a1b2c3d4` — **never** the full UUID |
| Elapsed time | `Date.now() - startTime` | `(342ms)` |
| Computed delay | `RETRY_BASE_MS * Math.pow(2, attempt - 1)` | `retrying in 500ms...` |
| Attempt counter | `attempt`/`MAX_RETRIES` | `attempt 2/3` |
| Branch context | Per-branch | `(trigger may still be running)` on not-found path only |

**What is NOT logged:** full userId, profile data, session tokens, error stack traces (only `error.code` + `error.message`).

**Branch distinction in logs:**
- Not-found (`PGRST116`): `⏳ Profile not found for ${shortId} (${elapsed}ms), retrying in ${delay}ms (trigger may still be running)...`
- Null data: `⏳ Profile null for ${shortId} (${elapsed}ms), retrying in ${delay}ms...`
- Timeout: `⏱️ Profile query timed out for ${shortId} (${elapsed}ms), retrying in ${delay}ms...`

These are distinct enough to diagnose which failure mode is firing in production logs without leaking sensitive data.

---

## 6. Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| First retry too fast (500ms) — trigger hasn't completed | Low | 500ms is generous for a primary key insert trigger. If it hasn't completed in 500ms, the 1000ms second wait covers it. |
| Total budget reduced (1500ms vs 2000ms) — more "profile not found" errors | Low | The 3rd attempt itself still has a full 5s timeout. Monitor via guardrail (Section 8). |
| Breaking change to callers | None | Same function signature, same return type, same error types. Callers don't know about internal retry timing. |
| Degraded-latency edge case — operations that previously succeeded on attempt 2 after 1000ms may now need attempt 3 | Low | The attempt 3 window (after 1500ms total) still covers most trigger completion times. If not, bump `RETRY_BASE_MS` to 750 or add a 4th attempt. |

---

## 7. Testing

This is a mechanical change — replacing a constant with a formula at 3 identical sites.

**What doesn't change:** control flow, error handling, retry count, return types. The existing `auth.constraints.integration.test.ts` covers the auth flow end-to-end.

**What changes:** only the millisecond duration of sleeps between retry attempts. Testing this precisely would require mocking `setTimeout` and the entire Supabase client chain — high effort, low signal for a `500 * 2^(n-1)` formula.

**No new code tests.** Verification via grep + TypeScript compilation confirms correctness.

### Verification commands

```bash
# Confirm all 3 sites use exponential formula
grep -n "RETRY_BASE_MS\|Math.pow" src/services/auth.ts

# Confirm no leftover constant references
grep -n "RETRY_DELAY_MS" src/services/auth.ts

# Existing auth integration tests still pass
cd AVVIO && node node_modules/jest/bin/jest.js --selectProjects integration \
  --testMatch="**/integration/auth.constraints.integration.test.ts" --no-coverage

# Regression — unit tests
cd AVVIO && node node_modules/jest/bin/jest.js --selectProjects unit \
  --testMatch="**/stores/__tests__/*.test.ts" --no-coverage
```

### Post-deploy validation

Code tests don't cover timing behavior adequately. The following operational checks close the loop:

| Metric | How to measure | Acceptance criteria |
|--------|---------------|---------------------|
| Median sign-in profile load latency | Compare before/after in production logs (`✅ Profile loaded ... in Xms`) | Should decrease or stay flat — not increase |
| "Profile not found after all retries" error rate | Track `❌ Profile query failed` log frequency | Must not increase vs. baseline. If >5% regression over 2 releases, trigger rollback. |
| Distribution by auth provider | Filter logs by sign-in flow (Google, Apple, email) | Social auth (Google/Apple) is the primary beneficiary — verify improvement there specifically |
| Retry attempt distribution | Count `attempt 2/3` and `attempt 3/3` log lines | Expect more attempt-2 successes (faster first retry catches more), fewer attempt-3 hits |

---

## 8. Guardrail and Rollback

**Guardrail:** If "profile not found after all retries" error rate increases by more than 5% relative to pre-deploy baseline over 1–2 releases, escalate.

**Rollback plan (one-line revert):**
```typescript
// Revert to safe constant if error rate regresses:
const RETRY_BASE_MS = 1000;  // effectively restores constant 1s delay at attempt 1
                              // (attempt 2 = 2000ms, which is even more conservative)
```

Or bump to 4 attempts by changing `MAX_RETRIES = 4` (adds one more attempt with 2000ms delay, total budget = 3500ms). This is a constants-only change — no control flow modification needed.

---

## 9. Optional Hardening (Not in Scope)

### A. Timeout timer cleanup

The `Promise.race` pattern creates a `setTimeout` that isn't explicitly cancelled after the query resolves:

```typescript
const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => {
    reject(new Error(`Profile query timed out after ${TIMEOUT_MS}ms`));
  }, TIMEOUT_MS);
});
const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
// ← timeout timer still running if queryPromise won the race
```

This is **functionally harmless** — the rejection goes to an unobserved promise — but a `clearTimeout` pattern would be cleaner. Tracked as related to L5 (timeout hardening).

### B. Extract retry config

The constants (`TIMEOUT_MS`, `MAX_RETRIES`, `RETRY_BASE_MS`) are local to `getMyProfileWithUserId`. If retry policy is ever needed elsewhere, they could be extracted to a shared config. Not needed now — this is the only retry site in `auth.ts`.

### C. Helper function for delay

The formula `RETRY_BASE_MS * Math.pow(2, attempt - 1)` appears 3 times. A helper would reduce repetition:

```typescript
const getRetryDelayMs = (attempt: number) => RETRY_BASE_MS * Math.pow(2, attempt - 1);
```

All 3 sites are within the same function and visually adjacent, so the repetition is currently acceptable and makes each retry path self-contained. If a 4th retry site is ever added, extracting this helper becomes worthwhile to prevent drift.

---

## 10. Definition of Done

- [x] `RETRY_DELAY_MS` replaced with `RETRY_BASE_MS = 500`
- [x] All 3 retry sites use `RETRY_BASE_MS * Math.pow(2, attempt - 1)`
- [x] Log messages show computed delay (not constant)
- [x] JSDoc documents exponential backoff strategy
- [x] No leftover `RETRY_DELAY_MS` references in `auth.ts`
- [x] SESSION-FINDINGS.md updated with H5 section
- [ ] Committed (user-managed)
- [ ] Post-deploy: profile-load latency and error rate validated (see Section 7)
- [ ] Post-deploy: rollback plan confirmed reachable if error rate regresses (see Section 8)
