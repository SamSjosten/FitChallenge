# V1 to V2 UI Migration Guide

> **Last Updated:** February 2025  
> **Status:** V2 migration in progress

This guide describes the UI migration from V1 to V2 and how to work with both versions during the transition.

## Overview

FitChallenge uses a **parallel route architecture** for the V1 → V2 migration:

```
app/
├── (auth)/              # V1 auth screens
├── (auth-v2)/           # V2 auth screens
├── (tabs)/              # V1 main tabs
├── (tabs-v2)/           # V2 main tabs
└── _layout.tsx          # Routes to V1 or V2 based on feature flag
```

This approach enables:

- Zero-risk development (V2 changes don't affect V1 users)
- Instant rollback (flip feature flag to revert)
- Side-by-side testing during development
- Gradual user migration

## Feature Flag

The UI version is controlled by the feature flag system:

```typescript
import { useFeatureFlags } from "@/lib/featureFlags";

const { isV2, toggleVersion } = useFeatureFlags();
```

See [Feature Flags Architecture](../architecture/feature-flags.md) for details.

---

## V1 vs V2 Differences

### Visual Design

| Aspect        | V1                      | V2                     |
| ------------- | ----------------------- | ---------------------- |
| Primary Color | Electric Mint (#00D26A) | Emerald (#10B981)      |
| Typography    | System fonts            | Plus Jakarta Sans      |
| Card Style    | Flat                    | Subtle shadows         |
| Icons         | Mixed                   | Heroicons (consistent) |
| Dark Mode     | Basic                   | Full support           |

### Navigation Structure

**V1:**

```
(tabs)/
├── index.tsx         # Dashboard
├── challenges.tsx    # Challenge list
├── friends.tsx       # Friends list
└── profile.tsx       # Profile/settings
```

**V2:**

```
(tabs-v2)/
├── index.tsx         # Home (redesigned)
├── challenges.tsx    # Challenges (with filters)
├── friends.tsx       # Friends (redesigned)
├── profile.tsx       # Profile (redesigned)
└── create.tsx        # Quick create (FAB)
```

### Component Architecture

**V1:** Components mixed in `src/components/`
**V2:** Organized structure:

- `src/components/shared/` — Design system primitives
- `src/components/v2/` — V2-specific components

---

## Working with V2

### Creating New V2 Screens

1. Create the screen in the appropriate V2 route group:

```typescript
// app/(tabs-v2)/my-screen.tsx
import { useFeatureFlags } from '@/lib/featureFlags';
import { LoadingState, ErrorState } from '@/components/v2';

export default function MyScreen() {
  // Use V2 components
  return (
    <ScreenContainer>
      {/* V2 content */}
    </ScreenContainer>
  );
}
```

2. Use V2 components from `src/components/v2/` or `src/components/shared/`

3. Follow V2 styling conventions (emerald theme, Plus Jakarta Sans)

### Converting V1 Screens to V2

1. **Copy** the V1 screen to the V2 route group
2. **Replace** V1 components with V2 equivalents
3. **Update** styling to match V2 theme
4. **Test** both versions still work independently

Example conversion:

```typescript
// V1: app/(tabs)/challenges.tsx
import { View, Text, StyleSheet } from 'react-native';
import { ChallengeList } from '@/components/ChallengeList';

export default function ChallengesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Challenges</Text>
      <ChallengeList />
    </View>
  );
}

// V2: app/(tabs-v2)/challenges.tsx
import { ScreenContainer } from '@/components/shared';
import { ChallengeCard, ChallengeFilter, LoadingState } from '@/components/v2';
import { useChallengeFilters } from '@/hooks/v2/useChallengeFilters';

export default function ChallengesScreen() {
  const { filter, setFilter } = useChallengeFilters();

  return (
    <ScreenContainer>
      <ChallengeFilter value={filter} onChange={setFilter} />
      {/* V2 challenge list with new components */}
    </ScreenContainer>
  );
}
```

### Sharing Code Between V1 and V2

For truly shared functionality, place code in:

- `src/services/` — Business logic (version-agnostic)
- `src/hooks/` — Data hooks (version-agnostic)
- `src/lib/` — Utilities (version-agnostic)
- `src/components/shared/` — Design primitives (styled for V2)

**Avoid:**

- Importing V1 components in V2 screens
- Importing V2 components in V1 screens
- Cross-version dependencies

---

## Testing Both Versions

### Development

Toggle UI version in settings or use the hook:

```typescript
// In dev, you can force a version
import { featureFlags } from "@/lib/featureFlags";
await featureFlags.setUIVersion("v2");
```

### E2E Tests

E2E tests should work with both versions:

```typescript
// e2e/tests/challenges.e2e.ts
describe("Challenges", () => {
  beforeAll(async () => {
    // Set version for this test suite
    await device.launchApp({
      newInstance: true,
      launchArgs: { uiVersion: "v2" },
    });
  });

  it("should display challenge list", async () => {
    // Test V2 challenge list
  });
});
```

---

## Migration Checklist

### Before V2 Becomes Default

- [ ] All main screens have V2 versions
  - [ ] Home
  - [ ] Challenges
  - [ ] Challenge Detail
  - [ ] Challenge Create
  - [ ] Friends
  - [ ] Friend Requests
  - [ ] Profile
  - [ ] Settings
  - [ ] Notifications
- [ ] E2E tests pass for V2
- [ ] Performance profiling complete
- [ ] Accessibility audit complete
- [ ] Dark mode works throughout

### Flipping the Default

1. Change `DEFAULT_UI_VERSION` in `src/lib/featureFlags.ts`:

   ```typescript
   const DEFAULT_UI_VERSION: UIVersion = "v2";
   ```

2. Deploy and monitor:
   - Crash rates
   - User engagement
   - Support tickets

3. If issues arise:
   - Change default back to `"v1"`
   - Deploy hotfix

### After Stable V2 Rollout (2-4 weeks)

1. Remove V1 routes:

   ```bash
   rm -rf app/(tabs)
   rm -rf app/(auth)
   ```

2. Remove V1 components:

   ```bash
   # Move shared to root, remove V1-specific
   ```

3. Remove feature flag checks from routing

4. Keep feature flag system for future migrations

---

## Troubleshooting

### "Screen shows V1 instead of V2"

1. Check feature flag state:

   ```typescript
   const state = await featureFlags.getState();
   console.log(state.uiVersion);
   ```

2. Clear AsyncStorage and restart:
   ```typescript
   await AsyncStorage.clear();
   ```

### "V2 screen is missing"

1. Ensure screen exists in `app/(tabs-v2)/`
2. Check route name matches V1 equivalent
3. Verify `_layout.tsx` includes the route

### "Styling looks wrong in V2"

1. Use theme constants from `src/constants/theme.ts`
2. Ensure Plus Jakarta Sans fonts are loaded
3. Check component is from `v2/` or `shared/`, not V1

---

## Related Documents

- [Feature Flags Architecture](../architecture/feature-flags.md)
- [Component Library](../api/components.md)
- [ADR-001: Parallel Routes](../decisions/ADR-001-parallel-routes.md)
