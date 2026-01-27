# FitChallenge Testing Strategy

This document defines the testing structure, conventions, and contracts for FitChallenge.

---

## Why Five Tiers?

FitChallenge uses a five-tier testing strategy, each serving a distinct purpose:

| Tier            | Purpose                                    | Feedback Speed | Network Required  |
| --------------- | ------------------------------------------ | -------------- | ----------------- |
| **Unit**        | Catch logic bugs in isolation              | < 1 second     | ❌ No             |
| **Component**   | Catch UI rendering/interaction regressions | 2-5 seconds    | ❌ No             |
| **Integration** | Catch RLS/RPC contract violations          | 5-30 seconds   | ✅ Yes (Supabase) |
| **E2E**         | Catch full flow regressions on device      | 1-5 minutes    | ✅ Yes (real app) |
| **Manual QA**   | Catch UX issues tests can't                | Minutes        | ✅ Yes (full app) |

This layered approach follows the [testing pyramid](https://martinfowler.com/articles/practical-test-pyramid.html): many fast unit tests, focused component tests, fewer integration tests, targeted E2E tests, and manual verification.

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

### 2. Component Tests

**Location:** `src/__tests__/component/*.component.test.tsx`

**Purpose:** Verify that UI components render correctly and respond to user interactions.

**Characteristics:**

- **Mocked dependencies** — All hooks, navigation, and providers are mocked
- **Fast** — No network calls, renders in jsdom
- **Behavior-focused** — Tests what users see and do, not implementation details

**What to test:**

- Key elements render (headings, buttons, inputs)
- User interactions work (press button, enter text)
- Error/loading states display correctly
- Form validation feedback

**What NOT to test here:**

- Internal state changes (implementation detail)
- Actual API calls (use integration tests)
- Pixel-perfect styling (use visual regression tools)
- Full user flows across screens (use E2E tests)

**Run command:**

```bash
npm run test:component
```

**Key mocks provided in `jest.setup.ts`:**

- `mockAuthState` — Control auth state for testing
- `mockChallengesState` — Control challenge hooks state (activeChallenges, pendingInvites, etc.)
- `mockRouter` — Verify navigation calls
- `mockSearchParams` — Set route parameters for detail screens
- `mockTheme` — Provides theme values without loading fonts

**Current test files:**
| File | Tests | Description |
|------|-------|-------------|
| `login.component.test.tsx` | 13 | Auth flow, validation, loading states |
| `home.component.test.tsx` | 17 | Dashboard, challenges list, invites, streaks |
| `create-challenge.component.test.tsx` | 23 | Form inputs, validation, creation flow |
| `challenge-detail.component.test.tsx` | 24 | Leaderboard, log activity, invite modal |

---

### 3. Integration Tests

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

### 4. End-to-End (E2E) Tests

**Location:** `e2e/**/*.e2e.ts`

**Purpose:** Validate complete user journeys on real iOS simulators and Android emulators using Detox.

**Characteristics:**

- **Real Device** — Runs on actual iOS Simulator or Android Emulator
- **Full Stack** — Tests the complete app including navigation, persistence, and network
- **Slower** — 1-5 minutes per test file, run nightly in CI
- **High Confidence** — Catches regressions that unit/integration tests miss

**Test Files:**

| File                        | Purpose                                                                    |
| --------------------------- | -------------------------------------------------------------------------- |
| `happy-path.e2e.ts`         | Critical smoke test: login → create challenge → log activity → leaderboard |
| `auth.e2e.ts`               | Authentication flows: sign in, sign out, session persistence               |
| `challenge-creation.e2e.ts` | Challenge creation and validation                                          |
| `activity-flow.e2e.ts`      | Activity logging and progress updates                                      |
| `invite-flow.e2e.ts`        | Challenge invites, acceptance, leaderboard access                          |

**What to test:**

- Complete user workflows
- Navigation between screens
- Data persistence across app restarts
- Session management
- Error handling in real scenarios

**What NOT to test here:**

- Individual function logic (use unit tests)
- Database constraints (use integration tests)
- Exhaustive edge cases (too slow)

**Run commands:**

```bash
# Build first (one-time per code change)
npm run e2e:build:ios          # iOS debug build
npm run e2e:build:android      # Android debug build

# Run all E2E tests
npm run e2e:test:ios
npm run e2e:test:android

# Run smoke tests only (fastest)
npm run e2e:smoke:ios
npm run e2e:smoke:android
```

**Setup required:**

1. Seed test users:

   ```bash
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run e2e:seed
   ```

2. iOS: Ensure Xcode and iPhone 15 simulator are available
3. Android: Ensure Android Studio and Pixel_4_API_34 emulator are configured

**CI Integration:**

E2E tests run nightly at 4am UTC via GitHub Actions (`.github/workflows/e2e.yml`).
Manual trigger available with platform and test suite selection.

See `e2e/README.md` for detailed documentation.

---

### 5. Manual QA Checklist

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

| Command                    | What it runs                   | When to use                       |
| -------------------------- | ------------------------------ | --------------------------------- |
| `npm test`                 | Unit tests only                | Quick feedback during development |
| `npm run test:unit`        | Unit tests only                | Same as above (explicit)          |
| `npm run test:component`   | Component tests only           | After UI changes                  |
| `npm run test:integration` | Integration tests only         | After schema/RLS changes          |
| `npm run test:all`         | Unit + Component + Integration | Before committing, CI             |

---

## Contracts & Rules

### Unit Test Contract

1. **No network calls** — Mock all external dependencies
2. **No Supabase client** — If you need `getSupabaseClient()`, it's an integration test
3. **No shared state** — Each test must be independent
4. **Fast** — Individual tests should complete in < 100ms

### Component Test Contract

1. **All hooks mocked** — Use mocks from `jest.setup.ts`
2. **No real navigation** — Use `mockRouter` to verify navigation calls
3. **Behavior over implementation** — Test what users see/do, not internal state
4. **Reset mocks between tests** — `beforeEach` in setup handles this automatically
5. **Avoid snapshots** — They're brittle; prefer explicit assertions

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
| `*.component.test.tsx`  | Component test   | `login.component.test.tsx`       |
| `*.integration.test.ts` | Integration test | `challenges.integration.test.ts` |

Jest config uses these patterns to separate test projects:

- Unit project: matches `*.test.ts`, ignores `*.integration.test.ts` and `*.component.test.tsx`
- Component project: matches only `*.component.test.tsx`
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
3. Component tests (`npm run test:component`)

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

### Adding a Component Test

1. Create file with `.component.test.tsx` extension in `src/__tests__/component/`
2. Import the component and testing utilities from `@testing-library/react-native`
3. Use mocks from `jest.setup.ts` (e.g., `mockAuthState`, `mockRouter`)
4. Customize mock state before rendering if needed
5. Focus on behavior: what renders, what happens on interaction
6. Run `npm run test:component` to verify

Example:

```typescript
import { render, screen, fireEvent } from "@testing-library/react-native";
import MyScreen from "../../../app/my-screen";
import { mockAuthState } from "./jest.setup";

describe("MyScreen", () => {
  it("renders the main heading", () => {
    render(<MyScreen />);
    expect(screen.getByText("My Heading")).toBeTruthy();
  });

  it("shows error when auth fails", () => {
    mockAuthState.error = { message: "Failed" } as any;
    render(<MyScreen />);
    expect(screen.getByText("Failed")).toBeTruthy();
  });
});
```

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
