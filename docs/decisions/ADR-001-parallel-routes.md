# ADR-001: Parallel Routes for V1/V2 UI Migration

**Status:** Accepted  
**Date:** January 2025  
**Decision Makers:** Sam, Claudette

## Context

FitChallenge needed to migrate from V1 UI (Electric Mint theme, basic components) to V2 UI (Emerald theme, redesigned components). This required changing every screen while maintaining a working app.

### Options Considered

1. **In-place migration** — Modify V1 screens directly
2. **Branch-based migration** — Develop V2 in a feature branch, merge when complete
3. **Parallel routes** — Maintain V1 and V2 simultaneously, route via feature flag

### Constraints

- App Store requires working app at all times
- Need ability to roll back instantly if V2 has issues
- Development should be incremental, not big-bang
- Testing must verify both versions work

## Decision

**Chosen: Parallel Routes**

Create duplicate route groups:

- `app/(tabs)/` → V1 tabs
- `app/(tabs-v2)/` → V2 tabs
- `app/(auth)/` → V1 auth
- `app/(auth-v2)/` → V2 auth

A feature flag (`useFeatureFlags`) controls which routes are active.

## Rationale

### Why Not In-Place Migration?

- **Risk:** Every change affects all users immediately
- **No rollback:** Can't revert to previous UI state
- **Testing complexity:** Hard to compare V1 vs V2

### Why Not Branch-Based?

- **Merge conflicts:** Long-lived branch diverges from main
- **No incremental delivery:** Must complete everything before merge
- **Testing gap:** V2 isn't tested in production environment until merge

### Why Parallel Routes?

- **Zero risk:** V2 changes don't affect V1 users
- **Instant rollback:** Flip flag to revert
- **Incremental:** Ship V2 screens as they're ready
- **A/B testing:** Can compare V1 vs V2 behavior
- **Team productivity:** No waiting for complete V2

## Consequences

### Positive

- Safe, reversible migration path
- Developers can work on V2 without breaking V1
- QA can test both versions in same build
- Users can opt-in to V2 early (beta testing)

### Negative

- **Code duplication:** Some screens exist in both versions
- **Bundle size:** Both versions included in app bundle
- **Maintenance burden:** Bug fixes may need to be applied to both
- **Cleanup required:** V1 must be removed after V2 is stable

### Mitigation

- Share business logic via services/hooks (version-agnostic)
- Use shared components in `src/components/shared/`
- Plan V1 removal for 2-4 weeks after V2 becomes default
- Document migration patterns for consistency

## Implementation

### Route Structure

```
app/
├── _layout.tsx          # Routes based on feature flag
├── (auth)/              # V1 auth
├── (auth-v2)/           # V2 auth
├── (tabs)/              # V1 tabs
├── (tabs-v2)/           # V2 tabs
└── [shared routes]      # Version-agnostic (settings, etc.)
```

### Feature Flag

```typescript
// src/lib/featureFlags.ts
const DEFAULT_UI_VERSION: UIVersion = "v1"; // Change to "v2" for rollout

function useFeatureFlags() {
  // Returns current version, allows toggling
}
```

### Routing Logic

```typescript
// app/_layout.tsx
const { uiVersion } = useFeatureFlags();

if (uiVersion === 'v2') {
  return <Redirect href="/(tabs-v2)" />;
}
return <Redirect href="/(tabs)" />;
```

## Related

- [Feature Flags Architecture](../architecture/feature-flags.md)
- [UI Migration Guide](../guides/ui-migration.md)
- [ADR-002: Health Provider Abstraction](./ADR-002-health-abstraction.md)
