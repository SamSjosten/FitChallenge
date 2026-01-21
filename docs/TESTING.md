# FitChallenge Testing Strategy

This document defines the testing structure, conventions, and contracts for FitChallenge.

---

## Why Three Tiers?

FitChallenge uses a three-tier testing strategy, each serving a distinct purpose:

| Tier            | Purpose                           | Feedback Speed | Network Required  |
| --------------- | --------------------------------- | -------------- | ----------------- |
| **Unit**        | Catch logic bugs in isolation     | < 1 second     | ❌ No             |
| **Integration** | Catch RLS/RPC contract violations | 5-30 seconds   | ✅ Yes (Supabase) |
| **Manual QA**   | Catch UX issues tests can't       | Minutes        | ✅ Yes (full app) |

This layered approach follows the [testing pyramid](https://martinfowler.com/articles/practical-test-pyramid.html): many fast unit tests, fewer integration tests, and targeted manual verification.

---

## Test Tiers

### 1. Unit Tests

**Location:** `src/**/__tests__/**/*.test.ts` (excludes `*.integration.test.ts`)

**Purpose:** Verify isolated logic without external dependencies.

**Characteristics:**

- **Hermetic** — No network calls, no database, no file system
- **Fast** — Entire suite runs in seconds
- **Deterministic** — Same input always produces same output

**What to test:**

- Validation schemas (`src/lib/validation.ts`)
- Pure utility functions (`src/lib/challengeStatus.ts`, `src/lib/serverTime.ts`)
- Data transformations and mappings
- Edge cases in business logic

**What NOT to test here:**

- Supabase queries (use integration tests)
- React components (use component tests — future)
- Full user flows (use E2E tests — future)

**Run command:**

```bash
npm run test:unit
```

---

### 2. Integration Tests

**Location:** `src/__tests__/integration/*.integration.test.ts`

**Purpose:** Verify that app code correctly interacts with Supabase (RLS policies, RPC functions, schema constraints).

**Characteristics:**

- **Requires real Supabase** — Uses `.env.test` credentials
- **Tests actual RLS** — Runs as authenticated test users
- **Slower** — Network latency adds up

**What to test:**

- RPC function behavior (`log_activity`, `create_challenge_with_participant`, etc.)
- RLS policy enforcement (visibility, authorization)
- Database constraints (unique indexes, foreign keys)
- Multi-user scenarios (invites, friend requests)

**What NOT to test here:**

- UI rendering
- Pure logic (use unit tests)

**Run command:**

```bash
npm run test:integration
```

**Setup required:**

```bash
cp .env.test.example .env.test
# Edit .env.test with Supabase credentials
```

Required environment variables:
| Variable | Source |
|----------|--------|
| `SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API |

⚠️ **Never commit `.env.test`** — the service role key bypasses RLS.

---

### 3. Manual QA Checklist

**Location:** `README.md` § "Testing the Happy Path"

**Purpose:** Verify end-to-end user experience that automated tests can't catch.

**When to run:**

- Before releases
- After major refactors
- When UI behavior changes

**What to verify:**

- Visual appearance matches design system
- Navigation flows feel correct
- Error messages are user-friendly
- Loading states appear appropriately

See README.md for the full checklist covering auth, challenge creation, invites, activity logging, and leaderboard verification.

---

## Commands Reference

| Command                    | What it runs           | When to use                       |
| -------------------------- | ---------------------- | --------------------------------- |
| `npm test`                 | Unit tests only        | Quick feedback during development |
| `npm run test:unit`        | Unit tests only        | Same as above (explicit)          |
| `npm run test:integration` | Integration tests only | After schema/RLS changes          |
| `npm run test:all`         | Unit + Integration     | Before committing, CI             |

---

## Contracts & Rules

### Unit Test Contract

1. **No network calls** — Mock all external dependencies
2. **No Supabase client** — If you need `getSupabaseClient()`, it's an integration test
3. **No shared state** — Each test must be independent
4. **Fast** — Individual tests should complete in < 100ms

### Integration Test Contract

1. **Real Supabase only** — No mocking the database
2. **Authenticated users** — Use `getTestUser1()` / `getTestUser2()` from setup
3. **Clean up after yourself** — See cleanup rules below
4. **Idempotent** — Running twice should produce same results

### Cleanup Rules

Integration tests create real data. To prevent pollution:

1. **Use `afterAll()` for cleanup** — Clean up at the end of each test file
2. **Use helper functions:**
   - `cleanupChallenge(id)` — Deletes challenge and related data
   - `cleanupTestUser(userId)` — Deletes user's data (not the user itself)
3. **Never delete test users** — Users are reused across test runs
4. **Service client for cleanup** — `createServiceClient()` bypasses RLS

Example:

```typescript
let challengeId: string;

afterAll(async () => {
  if (challengeId) {
    await cleanupChallenge(challengeId);
  }
});

it("creates a challenge", async () => {
  const challenge = await createTestChallenge(user.client);
  challengeId = challenge.id; // Save for cleanup
  expect(challenge.title).toBeDefined();
});
```

---

## Naming Conventions

### File Naming

| Pattern                 | Type             | Example                          |
| ----------------------- | ---------------- | -------------------------------- |
| `*.test.ts`             | Unit test        | `challenges.test.ts`             |
| `*.integration.test.ts` | Integration test | `challenges.integration.test.ts` |

Jest config uses these patterns to separate test projects:

- Unit project: matches `*.test.ts`, ignores `*.integration.test.ts`
- Integration project: matches only `*.integration.test.ts`

### Test Description Naming

Start descriptions with a verb describing the expected behavior:

```typescript
// ✅ Good — verb-first, describes behavior
it('returns empty array when user has no challenges', ...)
it('throws when challenge_id is invalid', ...)
it('prevents duplicate activity logs via idempotency key', ...)

// ❌ Bad — noun-first, describes implementation
it('empty challenges list', ...)
it('invalid challenge_id error', ...)
it('idempotency key check', ...)
```

### Describe Block Naming

Use the function or component name being tested:

```typescript
describe('challengeService.getMyActiveChallenges', () => { ... });
describe('getEffectiveStatus', () => { ... });
describe('friendsService', () => { ... });
```

---

## CI Integration

### Automated (Every PR)

The GitHub Actions workflow (`.github/workflows/test.yml`) runs on every PR and push to `main`:

1. TypeScript type checking (`npx tsc --noEmit`)
2. Unit tests (`npm run test:unit`)

### Manual Trigger (Integration)

Integration tests require secrets and run via `workflow_dispatch`:

1. Go to Actions → Test → Run workflow
2. Check "Run integration tests"
3. Requires `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` secrets

---

## Adding New Tests

### Adding a Unit Test

1. Create file in appropriate `__tests__` folder with `.test.ts` extension
2. Import only pure functions (no Supabase client)
3. Mock any external dependencies
4. Run `npm run test:unit` to verify

### Adding an Integration Test

1. Create file with `.integration.test.ts` extension in `src/__tests__/integration/`
2. Import helpers from `./setup.ts`
3. Use `getTestUser1()` / `getTestUser2()` for authenticated clients
4. Add cleanup in `afterAll()`
5. Run `npm run test:integration` to verify

---

## Troubleshooting

### "Cannot find module '@/...'"

Jest uses path mapping defined in `jest.config.js`. Ensure the module exists and the path is correct.

### Integration tests hang

Check that `.env.test` has valid credentials. Invalid credentials cause auth to hang.

### "duplicate key" errors in integration tests

Previous test run may have left data behind. Run cleanup manually:

```typescript
import { cleanupTestUser } from "./setup";
await cleanupTestUser("user-id-here");
```

### Tests pass locally but fail in CI

- **Unit tests:** Check for accidental network calls or time-dependent logic
- **Integration tests:** Ensure CI has correct secrets configured

---

_Last updated: January 2025_
