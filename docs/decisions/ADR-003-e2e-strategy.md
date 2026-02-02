# ADR-003: E2E Testing Strategy with Detox

**Status:** Accepted  
**Date:** January 2025  
**Decision Makers:** Sam, Claudette

## Context

FitChallenge needs end-to-end testing to verify user flows work correctly across the full stack (UI → Services → Database).

### Requirements

1. Test critical user journeys (auth, challenges, health sync)
2. Run in CI/CD pipeline
3. Support both V1 and V2 UI versions
4. Fast feedback loop for developers
5. Reliable (low flakiness)

### Options Considered

1. **Detox** — Gray-box testing for React Native
2. **Appium** — Cross-platform, Selenium-style
3. **Maestro** — YAML-based, newer tool
4. **Manual testing only** — No automation

## Decision

**Chosen: Detox**

Use Detox for E2E testing with:

- iOS Simulator as primary target
- GitHub Actions for CI
- Test database for isolation

## Rationale

### Why Detox?

| Factor               | Detox     | Appium  | Maestro |
| -------------------- | --------- | ------- | ------- |
| React Native support | Excellent | Good    | Good    |
| Speed                | Fast      | Slow    | Fast    |
| Reliability          | High      | Medium  | High    |
| CI integration       | Native    | Complex | Native  |
| Community            | Large     | Large   | Growing |
| Gray-box testing     | Yes       | No      | No      |

**Gray-box testing** is the key differentiator. Detox can:

- Synchronize with React Native animations
- Wait for network requests to complete
- Access app internals for setup/teardown

### Why Not Appium?

- Slower test execution (black-box approach)
- More flaky (relies on UI polling)
- Complex setup for React Native

### Why Not Maestro?

- Newer, less mature ecosystem
- Limited debugging capabilities
- Can't access app internals

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Test Runner                              │
│                     (Jest + Detox)                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     iOS Simulator                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   FitChallenge App                      │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │  Detox Server (communicates with test runner)   │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Test Supabase Instance                       │
│                  (Isolated from production)                     │
└─────────────────────────────────────────────────────────────────┘
```

## Test Structure

```
e2e/
├── tests/
│   ├── auth.e2e.ts        # Login, signup, logout
│   ├── challenges.e2e.ts  # Create, join, complete
│   ├── friends.e2e.ts     # Send/accept requests
│   ├── health.e2e.ts      # Health sync flows
│   ├── offline.e2e.ts     # Offline queue
│   └── profile.e2e.ts     # Profile management
├── utils/
│   ├── testHelpers.ts     # Common test utilities
│   ├── testData.ts        # Mock data factories
│   └── supabaseTestClient.ts
└── jest.config.js
```

## Test Categories

### Critical Path (Run on Every PR)

| Test             | Purpose                     |
| ---------------- | --------------------------- |
| Sign up          | New user registration works |
| Sign in          | Existing user can log in    |
| Create challenge | Core feature works          |
| Log activity     | Progress tracking works     |
| Accept invite    | Social features work        |

### Full Suite (Run Nightly)

All critical path tests plus:

- Edge cases (empty states, error handling)
- V1 and V2 UI coverage
- Health sync scenarios
- Offline/online transitions

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on:
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - name: Install dependencies
        run: npm ci
      - name: Build for E2E
        run: npm run e2e:build:ios
      - name: Run E2E tests
        run: npm run e2e:test:ios
```

### Test Database

E2E tests use a dedicated Supabase project:

- Seeded with test data before each suite
- Cleaned after each test run
- Never touches production data

```typescript
// e2e/utils/supabaseTestClient.ts
export async function seedTestData() {
  await supabase.rpc("seed_e2e_test_data");
}

export async function cleanupTestData() {
  await supabase.rpc("cleanup_e2e_test_data");
}
```

## Consequences

### Positive

- **Confidence:** Verify critical paths work end-to-end
- **Regression prevention:** Catch breaking changes before merge
- **Documentation:** Tests describe expected behavior
- **CI integration:** Automated checks on every PR

### Negative

- **Maintenance cost:** Tests need updating when UI changes
- **CI time:** E2E tests add 10-15 minutes to pipeline
- **Flakiness risk:** Network issues can cause false failures
- **Infrastructure:** Requires dedicated test database

### Mitigation

- Keep tests focused on critical paths (not exhaustive)
- Use Detox's synchronization features to reduce flakiness
- Retry failed tests once before failing (CI config)
- Invest in test data factories for easy maintenance

## Test Patterns

### Page Objects

```typescript
// e2e/pages/LoginPage.ts
export class LoginPage {
  async enterEmail(email: string) {
    await element(by.id("email-input")).typeText(email);
  }

  async enterPassword(password: string) {
    await element(by.id("password-input")).typeText(password);
  }

  async tapLogin() {
    await element(by.id("login-button")).tap();
  }
}
```

### Data Factories

```typescript
// e2e/utils/testData.ts
export function createTestUser(): TestUser {
  const id = `test-${Date.now()}`;
  return {
    email: `${id}@test.fitchallenge.app`,
    password: "TestPassword123!",
    username: id,
  };
}
```

### Assertions

```typescript
// e2e/tests/auth.e2e.ts
describe("Authentication", () => {
  it("should sign in with valid credentials", async () => {
    const user = await seedUser();

    await loginPage.enterEmail(user.email);
    await loginPage.enterPassword(user.password);
    await loginPage.tapLogin();

    await expect(element(by.id("home-screen"))).toBeVisible();
  });
});
```

## Related

- [Testing Documentation](../TESTING.md)
- [CI/CD Workflows](../../.github/workflows/)
- [ADR-001: Parallel Routes](./ADR-001-parallel-routes.md) (V1/V2 testing)
