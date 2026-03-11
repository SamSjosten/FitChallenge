# H4. Push Token Disable Lacks User Filter

**Severity:** HIGH
**File:** `src/services/pushTokens.ts` lines 169-198
**Status:** IMPLEMENTED (code + 4 integration tests + 6 unit tests)
**Date:** 2026-03-10
**Cross-ref:** Plan item H4, `eager-puzzling-frog.md`

---

## 1. Problem Statement

When a user signs out, `disableCurrentToken()` marks their push token as disabled in the database. Here's the current code:

```typescript
// src/services/pushTokens.ts lines 185-189
const { error } = await getSupabaseClient()
  .from("push_tokens")
  .update({ disabled_at: new Date().toISOString() })
  .eq("token", token);
```

**Two problems:**

### Problem A: No `user_id` filter (defense-in-depth gap)

The query filters only by `token`, not by `(user_id, token)`. This means if the same Expo push token exists for multiple users (which the schema allows — see unique constraint below), the query _intends_ to update all rows matching that token, not just the signing-out user's row.

In practice, **RLS saves us** — the database has:
```sql
-- supabase/migrations/20240101000007_rls_policies.sql line 152
on public.push_tokens for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

So the update only touches rows where `user_id = auth.uid()` regardless. But this is an **accidental defense**, not an intentional one. The code _looks_ like it could affect other users' tokens, and if RLS were ever relaxed (e.g., a service-role context), it would.

**Why does this matter?** Defense-in-depth is a core security principle: every layer should enforce its own constraints independently. The application code should not _rely_ on the database to catch its mistakes — it should be correct on its own, with RLS as a safety net.

The schema allows duplicate tokens across users:
```sql
-- supabase/migrations/20240101000005_push_tokens.sql line 18
unique(user_id, token)  -- unique per user, NOT globally unique
```

### Problem B: No `withAuth()` wrapper (inconsistent pattern)

Compare `disableCurrentToken()` to `registerToken()`:

| Method | Uses `withAuth()`? | Has `user_id` in query? |
|--------|-------------------|------------------------|
| `registerToken()` (line 126) | Yes | Yes (`user_id: userId` in upsert) |
| `disableCurrentToken()` (line 186) | **No** | **No** |

`registerToken` correctly uses `withAuth()` to:
1. Verify the user is authenticated before making the DB call
2. Get the authenticated `userId` to include in the query

`disableCurrentToken` skips both. It calls `getSupabaseClient()` directly, which means:
- No explicit auth check — relies entirely on the Supabase session being valid
- No `userId` available to add to the query filter
- If called when the session is already expired/cleared, it silently fails (the `catch` swallows errors)

This is a violation of the project's own `CLAUDE.md` guideline:
> "Helper functions are preferred for authenticated operations: `withAuth(fn)` — wraps operation with user ID injection"

---

## 2. Root Cause: Why Does This Pattern Exist?

This is a common pattern in early-stage code. The developer knew that:
1. The Expo push token is device-specific (fetched from the device)
2. RLS constrains the update to the current user's rows

So the `user_id` filter felt redundant. But this reasoning has gaps:

**Gap 1: The query expresses wrong intent.** `.eq("token", token)` says "disable _all_ rows with this token" — the developer meant "disable _my_ row with this token." Code should express what you mean, not rely on external constraints to narrow the result.

**Gap 2: `getSupabaseClient()` without `withAuth()` creates a silent-failure path.** If `disableCurrentToken()` is called after the Supabase session is already partially cleared (possible during sign-out race conditions), the client may have no valid JWT. The update would silently match zero rows (RLS filters everything), and the catch block would swallow any error. The token stays enabled, and the user keeps getting push notifications for an account they signed out of.

**Gap 3: Inconsistency is a bug magnet.** When one method in a service uses `withAuth()` and another doesn't, future developers will copy whichever pattern is nearest. The inconsistency propagates.

---

## 3. Proposed Fix

### Change 1: Wrap in `withAuth()` and add `.eq("user_id", userId)`

```typescript
// BEFORE
async disableCurrentToken(): Promise<void> {
  if (!isNotificationSupported()) return;

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    if (!token) return;

    const { error } = await getSupabaseClient()
      .from("push_tokens")
      .update({ disabled_at: new Date().toISOString() })
      .eq("token", token);

    if (error) {
      console.warn("Failed to disable push token:", error);
    }
  } catch (err) {
    console.warn("Error disabling push token:", err);
  }
}

// AFTER
async disableCurrentToken(): Promise<void> {
  if (!isNotificationSupported()) return;

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    if (!token) return;

    await withAuth(async (userId) => {
      const { error } = await getSupabaseClient()
        .from("push_tokens")
        .update({ disabled_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("token", token);

      if (error) {
        console.warn("Failed to disable push token:", error);
      }
    });
  } catch (err) {
    console.warn("Error disabling push token:", err);
  }
}
```

### What changes and why

| Aspect | Before | After | Why |
|--------|--------|-------|-----|
| Auth check | None (implicit via session) | `withAuth()` — explicit | Fails fast if not authenticated instead of silently updating zero rows |
| Query filter | `.eq("token", token)` | `.eq("user_id", userId).eq("token", token)` | Expresses correct intent — "disable MY token on THIS device" |
| Error path | Swallows all errors | Auth error propagates to outer catch, DB errors still warned | `withAuth()` throws if not authenticated; the outer catch still handles gracefully for sign-out flow |

### Files changed

| File | Change type | Description |
|------|-------------|-------------|
| `src/services/pushTokens.ts` | Modified | `disableCurrentToken()` wrapped in `withAuth()`, added `.eq("user_id", userId)` |

---

## 4. Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `withAuth()` throws during sign-out if session already cleared | Low | The outer try/catch already handles this gracefully. `disableCurrentToken()` is called BEFORE `authService.signOut()` per C1 ordering, so the session should still be valid. |
| Double filter reduces matched rows | None | The `(user_id, token)` pair is the unique constraint key. If the row exists, both filters match. If it doesn't exist, neither filter would have matched alone. |
| Behavioral change for users | None | Same row gets updated. RLS was already limiting to self-only rows. The fix just makes the code match what the database was already enforcing. |

---

## 5. Teaching Concepts

### Defense-in-Depth
Never rely on a single layer for security. Even though RLS prevents cross-user updates, the application code should independently filter by `user_id`. If RLS is ever bypassed (service role, migration, policy change), the application code still does the right thing.

### Command-Query Separation of Concerns
`registerToken` and `disableCurrentToken` are complementary operations on the same table. They should follow the same patterns — both should use `withAuth()`, both should include `user_id` in their queries. When paired operations diverge in style, it signals a bug or oversight.

### Express Intent, Don't Rely on Constraints
`.eq("token", token)` relies on RLS to narrow the scope. `.eq("user_id", userId).eq("token", token)` explicitly declares "this user's token on this device." The second version is self-documenting — a reader knows exactly what row is being targeted without needing to check the RLS policy.

---

## 6. Testing — Two-Tier Strategy

### Tier 1: Integration tests (live Supabase) — ~4 tests

**File:** `src/__tests__/integration/push-tokens.integration.test.ts` (extend existing)

These test the actual database behavior — do the queries hit the right rows? Does RLS enforce scoping? These run against the live Supabase test instance.

#### New `describe("UPDATE/disable (self-only)")` group:

1. **User can disable their own token** — Insert token for user1, update `disabled_at` with `.eq("user_id", user1.id).eq("token", token)`, verify `disabled_at` is set.

2. **Disable with user_id filter does not affect other users' same token** — Insert same token string for both user1 and user2 (allowed by schema), user1 disables with `.eq("user_id", user1.id).eq("token", token)`, verify user2's token is still enabled (`disabled_at` is null).

3. **Disable without user_id filter is still scoped by RLS** — User1 attempts `.update({ disabled_at: ... }).eq("token", token)` (no user_id filter), verify only user1's row is affected (RLS enforces this), user2's row untouched. This proves the safety net works.

4. **Disable on non-existent token is a no-op** — Update with a token that doesn't exist, verify no error (graceful handling).

### Tier 2: Service-level unit tests — ~6 tests

**File:** `src/services/__tests__/pushTokens.test.ts` (new)

These test the `disableCurrentToken()` method's **orchestration logic** — the sequence of calls it makes, how it handles errors, and whether it wires `withAuth` + `user_id` correctly. Unit tests are required here because:
- `expo-notifications` (getExpoPushTokenAsync) — platform module, can't run in Node.js
- `expo-device` (Device.isDevice) — platform module, can't run in Node.js
- `expo-constants` (Constants.expoConfig) — platform module, can't run in Node.js

#### Mock setup (follows `challenges.test.ts` pattern):
- `jest.mock("@/lib/supabase")` — `getSupabaseClient` returns chain mock, `withAuth` calls operation with mock userId
- `jest.mock("expo-notifications")` — `getExpoPushTokenAsync` returns test token
- `jest.mock("expo-device")` — `isDevice` returns true/false
- `jest.mock("expo-constants")` — `expoConfig.extra.eas.projectId`
- Supabase chain: `.from().update().eq().eq()` using `.mockReturnThis()`

#### Test cases:
1. **Happy path** — calls `withAuth`, runs update with both `.eq("user_id", userId)` and `.eq("token", token)`, sets `disabled_at`
2. **Passes correct user_id from withAuth** — verify the userId from `withAuth` callback is used in `.eq("user_id", userId)`
3. **Not supported on non-device** — returns early without any DB call when `Device.isDevice` is false
4. **No token available** — returns early when `getExpoPushTokenAsync` returns empty data
5. **DB error logged as warning** — Supabase returns error object, logged via `console.warn` but not thrown (non-fatal for sign-out)
6. **Auth error caught gracefully** — `withAuth` throws (session expired during sign-out race), outer catch handles, no unhandled rejection

### Why both tiers?

| Tier | Proves | Can't prove |
|------|--------|-------------|
| Integration (Supabase) | RLS scoping works, `user_id` filter hits correct rows, cross-user isolation | Service method wiring (Expo modules can't run in Node.js) |
| Unit (mocked) | Service method calls `withAuth`, passes `userId`, handles errors, early-exits correctly | Actual database behavior |

Neither tier alone is sufficient. Together they cover both the database contract and the service orchestration.

### Test commands

```bash
# Integration tests (live Supabase)
cd AVVIO && node node_modules/jest/bin/jest.js --selectProjects integration \
  --testMatch="**/integration/push-tokens.integration.test.ts" --no-coverage

# Service unit tests
cd AVVIO && node node_modules/jest/bin/jest.js --selectProjects unit \
  --testMatch="**/services/__tests__/pushTokens.test.ts" --no-coverage
```

---

## 7. Sign-Out Race Semantics (Reviewer Feedback)

`disableCurrentToken()` is called during sign-out (AuthProvider.tsx line 504) **before** `authService.signOut()`. If the session is already partially cleared (race condition), `withAuth()` will throw, and the outer `catch` logs a warning and continues. The token remains enabled.

This is **acceptable best-effort behavior** because:
1. Call ordering maximizes success: disable happens while session is still valid
2. Non-fatal: sign-out must not fail because of a push token cleanup issue
3. Stale tokens are eventually cleaned up server-side (tokens with no activity age out)

This should be documented in JSDoc on the method.

---

## 8. Definition of Done

- [ ] `disableCurrentToken()` uses `withAuth()` wrapper
- [ ] Query includes `.eq("user_id", userId)` alongside `.eq("token", token)`
- [ ] JSDoc documents best-effort sign-out race semantics
- [ ] ~4 integration tests in `push-tokens.integration.test.ts` covering disable behavior
- [ ] ~6 unit tests in `pushTokens.test.ts` covering service orchestration
- [ ] All existing push token integration tests still pass
- [ ] SESSION-FINDINGS.md updated
