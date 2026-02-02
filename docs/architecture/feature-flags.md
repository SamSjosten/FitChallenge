# Feature Flags System

> **Last Updated:** February 2025  
> **Source:** `src/lib/featureFlags.ts`

This document describes the feature flag system used for the V1 → V2 UI migration.

## Overview

The feature flag system enables:

- **Zero-risk development** — New UI is isolated in parallel routes
- **Instant rollback** — Flip flag to revert to V1 immediately
- **Side-by-side comparison** — Developers can switch between versions
- **Gradual rollout** — Default can be changed without code deployment

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Feature Flags                             │
│                                                                  │
│  ┌──────────────────┐       ┌──────────────────┐                │
│  │  featureFlags    │       │ useFeatureFlags  │                │
│  │  (API object)    │ ◄───► │ (React hook)     │                │
│  └────────┬─────────┘       └────────┬─────────┘                │
│           │                          │                          │
│           ▼                          ▼                          │
│  ┌──────────────────┐       ┌──────────────────┐                │
│  │  AsyncStorage    │       │   Event Emitter  │                │
│  │  (persistence)   │       │  (cross-sync)    │                │
│  └──────────────────┘       └──────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

## API Reference

### `featureFlags` Object

The main API for interacting with feature flags.

```typescript
import { featureFlags } from "@/lib/featureFlags";

// Get current UI version
const version = await featureFlags.getUIVersion();
// Returns: 'v1' | 'v2'

// Set UI version (notifies all listeners)
await featureFlags.setUIVersion("v2");

// Toggle between v1 and v2
const newVersion = await featureFlags.toggleUIVersion();

// Get full state
const state = await featureFlags.getState();
// Returns: { uiVersion: 'v1', lastUpdated: '2025-01-15T...' }

// Reset to default
await featureFlags.resetToDefault();

// Get default version (synchronous)
const defaultVersion = featureFlags.getDefaultVersion();
// Returns: 'v1' (until changed in code)
```

### `useFeatureFlags` Hook

React hook for components that need to respond to version changes.

```typescript
import { useFeatureFlags } from '@/lib/featureFlags';

function MyComponent() {
  const {
    uiVersion,     // Current version: 'v1' | 'v2' | null (loading)
    isLoading,     // True while loading from storage
    isV2,          // Convenience: uiVersion === 'v2'
    toggleVersion, // Toggle between versions
    setVersion,    // Set specific version
  } = useFeatureFlags();

  if (isLoading) return <Loading />;

  return isV2 ? <V2Component /> : <V1Component />;
}
```

## Storage

Flags are persisted in AsyncStorage:

| Key                               | Value            | Description        |
| --------------------------------- | ---------------- | ------------------ |
| `fitchallenge_ui_version`         | `'v1'` or `'v2'` | Current UI version |
| `fitchallenge_ui_version_updated` | ISO timestamp    | Last change time   |

## Cross-Hook Synchronization

Multiple components using `useFeatureFlags` stay synchronized via an event emitter:

```typescript
// When setUIVersion is called:
// 1. Value is saved to AsyncStorage
// 2. All subscribed hooks are notified
// 3. Each hook updates its local state

// This ensures all components update simultaneously
// without requiring a page refresh
```

## Default Version

The default version is defined in `featureFlags.ts`:

```typescript
// Line 36: Change to 'v2' when ready for full rollout
const DEFAULT_UI_VERSION: UIVersion = "v1";
```

**To flip the default:**

1. Change `DEFAULT_UI_VERSION` to `"v2"`
2. Deploy the update
3. Users who never changed the setting will now see V2
4. Users who explicitly chose V1 will still see V1

## Usage in Routing

The root layout uses feature flags to select tab groups:

```typescript
// app/_layout.tsx (simplified)
function RootLayoutNav() {
  const { uiVersion, isLoading } = useFeatureFlags();

  if (isLoading) return <SplashScreen />;

  // Route to appropriate tab group based on version
  if (uiVersion === 'v2') {
    return <Redirect href="/(tabs-v2)" />;
  }
  return <Redirect href="/(tabs)" />;
}
```

## Screen-Level Usage

Individual screens can also branch on version:

```typescript
// app/notifications.tsx
import { useFeatureFlags } from '@/lib/featureFlags';
import V1NotificationsScreen from '@/components/NotificationsScreen';
import V2NotificationsScreen from '@/components/v2/NotificationsScreen';

export default function NotificationsScreen() {
  const { isV2, isLoading } = useFeatureFlags();

  if (isLoading) return <LoadingState />;

  return isV2 ? <V2NotificationsScreen /> : <V1NotificationsScreen />;
}
```

## Settings Integration

Users can toggle the UI version in settings:

```typescript
// app/settings/index.tsx
function SettingsScreen() {
  const { isV2, toggleVersion } = useFeatureFlags();

  return (
    <SettingRow
      label="New UI (Beta)"
      value={isV2}
      onToggle={toggleVersion}
    />
  );
}
```

## Rollback Procedure

### Instant Rollback (User-Level)

If a user encounters issues:

1. Navigate to Settings
2. Toggle "New UI" off
3. App immediately switches to V1

### Global Rollback (App-Level)

If V2 has critical bugs:

1. Change `DEFAULT_UI_VERSION` to `"v1"`
2. Deploy update
3. New users and users who haven't set a preference get V1
4. Existing V2 users keep V2 until they toggle or clear storage

### Emergency Rollback

For critical issues affecting all users:

1. Deploy with `DEFAULT_UI_VERSION = "v1"`
2. Add code to force-reset all users:

```typescript
// One-time migration in app startup
const FORCE_V1_VERSION = "2025-02-01"; // Date of forced rollback

async function checkForForcedRollback() {
  const lastForced = await AsyncStorage.getItem("forced_rollback_version");
  if (lastForced !== FORCE_V1_VERSION) {
    await featureFlags.setUIVersion("v1");
    await AsyncStorage.setItem("forced_rollback_version", FORCE_V1_VERSION);
  }
}
```

## Cleanup After Stable Rollout

Once V2 is stable and V1 is deprecated:

1. **Remove V1 routes** — Delete `app/(tabs)/` and `app/(auth)/`
2. **Remove feature flag checks** — Replace conditional rendering with V2 only
3. **Simplify routing** — Remove parallel route structure
4. **Keep flag system** — Useful for future migrations

Recommended timeline: 2-4 weeks after V2 becomes default, assuming no rollbacks.

## Testing

### Unit Tests

```typescript
describe("featureFlags", () => {
  beforeEach(() => {
    AsyncStorage.clear();
  });

  it("returns default version when not set", async () => {
    const version = await featureFlags.getUIVersion();
    expect(version).toBe("v1");
  });

  it("persists version changes", async () => {
    await featureFlags.setUIVersion("v2");
    const version = await featureFlags.getUIVersion();
    expect(version).toBe("v2");
  });

  it("notifies subscribers on change", async () => {
    const callback = jest.fn();
    featureFlags.subscribe(callback);

    await featureFlags.setUIVersion("v2");

    expect(callback).toHaveBeenCalledWith("v2");
  });
});
```

### E2E Tests

```typescript
// e2e/tests/feature-flags.e2e.ts
describe("Feature Flags", () => {
  it("should persist UI version across app restarts", async () => {
    // Set to V2
    await element(by.id("settings-tab")).tap();
    await element(by.id("new-ui-toggle")).tap();

    // Restart app
    await device.terminateApp();
    await device.launchApp();

    // Verify V2 is active
    await expect(element(by.id("v2-home-screen"))).toBeVisible();
  });
});
```

---

## Related Documents

- [UI Migration Guide](../guides/ui-migration.md) — V1 to V2 migration details
- [ADR-001: Parallel Routes](../decisions/ADR-001-parallel-routes.md) — Architecture decision
