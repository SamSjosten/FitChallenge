# H2. Navigation Store Mutates State During Read

**Severity:** HIGH
**File:** `src/stores/navigationStore.ts` lines 61-78
**Status:** CODE FIX APPLIED — TESTS PENDING
**Date:** 2026-03-06 (fix), 2026-03-10 (test plan)
**Cross-ref:** Plan item H2, `eager-puzzling-frog.md`

---

## 1. Problem Statement

`isNavigationLocked()` is a Zustand store method that reads lock state but also clears stale locks via `set()`:

```typescript
// BEFORE (buggy)
isNavigationLocked: () => {
  const { authHandlingNavigation, lockSetAt } = get();
  if (!authHandlingNavigation) return false;

  if (lockSetAt) {
    const lockAge = Date.now() - lockSetAt;
    if (lockAge > MAX_LOCK_DURATION_MS) {
      console.warn(`${LOG} ⚠️ STALE LOCK (age: ${lockAge}ms), auto-clearing`);
      set({ authHandlingNavigation: false, lockSetAt: null }); // <-- MUTATION DURING READ
      return false;
    }
  }
  return true;
},
```

This is called during React's render phase in `app/_layout.tsx:174`:

```typescript
if (isLoading && !isNavigationLocked()) {
```

Calling `set()` during render violates React's rules and can produce:
- "Cannot update a component while rendering a different component" console warning
- Unexpected re-renders of any subscriber to `authHandlingNavigation`

### Call sites (3 total)

| File | Context | Safe before fix? |
|------|---------|------------------|
| `app/_layout.tsx:174` | Render body | **NO** — `set()` during render |
| `useProtectedRoute.ts:49` | Inside `useEffect` | Yes |
| `navigationStore.ts:100` | AppState listener callback | Yes |

---

## 2. Root Cause

The function conflates two responsibilities:
1. **Query:** Is the navigation lock currently valid?
2. **Command:** Clear the lock if stale.

CQS (Command-Query Separation) violation — a query that mutates state is unpredictable when called from React's render phase, where side effects are forbidden.

---

## 3. Fix Applied

Split into two functions:

### `isNavigationLocked()` — pure read, no side effects
```typescript
// AFTER (fixed)
isNavigationLocked: () => {
  const { authHandlingNavigation, lockSetAt } = get();
  if (!authHandlingNavigation) return false;

  // Check if lock is stale — return false but do NOT mutate (safe for render)
  if (lockSetAt) {
    const lockAge = Date.now() - lockSetAt;
    if (lockAge > MAX_LOCK_DURATION_MS) {
      console.warn(`${LOG} ⚠️ STALE LOCK detected (age: ${lockAge}ms)`);
      return false;  // <-- pure read, no set() call
    }
  }
  return true;
},
```

### `clearStaleLock()` — new action, performs the mutation
```typescript
clearStaleLock: () => {
  const { authHandlingNavigation, lockSetAt } = get();
  if (!authHandlingNavigation || !lockSetAt) return false;

  const lockAge = Date.now() - lockSetAt;
  if (lockAge > MAX_LOCK_DURATION_MS) {
    console.warn(`${LOG} ⚠️ STALE LOCK auto-cleared (age: ${lockAge}ms)`);
    set({ authHandlingNavigation: false, lockSetAt: null });
    return true;
  }
  return false;
},
```

### Callers updated

| File | Before | After |
|------|--------|-------|
| `app/_layout.tsx:174` | `isNavigationLocked()` | `isNavigationLocked()` (unchanged — now safe) |
| `useProtectedRoute.ts:49` | `isNavigationLocked()` | `clearStaleLock()` then `isNavigationLocked()` |
| `navigationStore.ts:100` | `store.isNavigationLocked()` | `store.clearStaleLock()` |

The AppState listener and useEffect both call `clearStaleLock()` to actually clean up stale state. The render-time call in `_layout.tsx` just reads — if a stale lock exists but hasn't been cleared yet, it correctly returns `false` without mutating.

---

## 4. Files Changed

| File | Change type | Description |
|------|-------------|-------------|
| `src/stores/navigationStore.ts` | Modified | `isNavigationLocked` made pure; `clearStaleLock` action added; AppState listener updated |
| `src/hooks/useProtectedRoute.ts` | Modified | Added `clearStaleLock()` selector + call before `isNavigationLocked()` in useEffect; added to dep array |

---

## 5. Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Stale lock not cleared if no effect/listener fires | Very low | AppState listener fires on every foreground; useProtectedRoute effect runs on every nav check |
| Behavior change for callers | None | `isNavigationLocked()` returns identical values — just doesn't mutate |
| `_layout.tsx` sees stale lock as "locked" briefly | None | `isNavigationLocked()` returns `false` for stale locks (same as before) |

---

## 6. Testing

### Why unit tests (not integration)?

The navigation store is a **pure client-side Zustand state machine**. It has:
- Zero Supabase interaction (no database reads, no RPCs, no auth calls)
- Zero network calls of any kind
- No service layer dependencies

Per project testing preference: *"All tests must be ran against a live Supabase instance if possible. Only create Unit tests when integration testing isn't feasible."*

Integration testing is **not feasible** here — there is no database or server interaction to test against. This is the canonical case for unit tests: pure local state logic with deterministic inputs and outputs.

### Test file

`src/stores/__tests__/navigationStore.test.ts` (new file, follows existing pattern from `offlineStore.test.ts` and `securityStore.test.ts`)

### Mocking approach

- **`react-native` AppState**: Must be mocked — React Native platform module can't run in Node.js (same rationale as AsyncStorage mocks in offlineStore tests)
- **`Date.now()`**: Mocked via `jest.spyOn` for deterministic stale lock testing
- **No other mocks needed** — Zustand stores run natively in Jest

### Proposed test cases (~15 tests)

#### Group 1: `setAuthHandlingNavigation` (5 tests)
1. **Acquire lock** — sets `authHandlingNavigation: true` and records `lockSetAt` timestamp
2. **Release lock** — resets both fields to `false`/`null`
3. **Duplicate SET ignored** — calling SET when already locked is a no-op (idempotent)
4. **Duplicate CLEAR ignored** — calling CLEAR when not locked is a no-op
5. **Release reports held duration** — `lockSetAt` timestamp used for logging (verify state cleanup)

#### Group 2: `isNavigationLocked` — pure read (5 tests)
6. **Returns `false` when no lock held** — default state
7. **Returns `true` when lock is fresh** — lock set < 30s ago
8. **Returns `false` when lock is stale** — lock set > 30s ago, WITHOUT mutating state
9. **Does NOT call `set()` for stale locks** — the core fix: verify `authHandlingNavigation` remains `true` in state even though `isNavigationLocked()` returns `false`
10. **Returns `true` at exactly MAX_LOCK_DURATION_MS boundary** — edge case (lock age === 30000ms is not stale)

#### Group 3: `clearStaleLock` — mutation action (4 tests)
11. **Returns `false` and no-ops when no lock held**
12. **Returns `false` when lock is fresh** — does not clear a valid lock
13. **Returns `true` and clears stale lock** — sets `authHandlingNavigation: false`, `lockSetAt: null`
14. **State is fully reset after clearing** — `isNavigationLocked()` returns `false`, state fields are `false`/`null`

#### Group 4: CQS contract (the bug fix proof) (1 test)
15. **Stale lock: `isNavigationLocked` reads without mutation, `clearStaleLock` mutates** — set lock, advance time past 30s, call `isNavigationLocked()` (returns `false`, state unchanged), then call `clearStaleLock()` (returns `true`, state cleaned). This is the regression test that proves the original bug is fixed.

### Test command

```bash
cd AVVIO && node node_modules/jest/bin/jest.js --selectProjects unit \
  --testMatch="**/stores/__tests__/navigationStore.test.ts" --no-coverage
```

---

## 7. Definition of Done

- [ ] `isNavigationLocked()` is a pure read — no `set()` calls (verified by test #9)
- [ ] `clearStaleLock()` exists and performs stale lock mutation (verified by tests #13-14)
- [ ] `useProtectedRoute.ts` calls `clearStaleLock()` before `isNavigationLocked()` in useEffect
- [ ] AppState listener uses `clearStaleLock()` not `isNavigationLocked()`
- [ ] ~15 unit tests in `src/stores/__tests__/navigationStore.test.ts` — all passing
- [ ] All existing tests still pass (`offlineStore.test.ts`: 30, `securityStore.test.ts`: 26)
- [ ] SESSION-FINDINGS.md updated
