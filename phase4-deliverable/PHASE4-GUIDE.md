# Phase 4: Component Directory Restructuring

## What This Does

Eliminates all `v2/` naming from the codebase. Components ARE the components now — there's no "v1" they're replacing.

**Before:**
```
src/components/v2/           ← grab-bag of 15+ files
src/components/v2/create/    ← wizard components
src/components/v2/home/      ← home-screen components
src/components/challenge-detail-v2/  ← V2 suffix in dirname AND component name
src/components/shared/       ← 8 dead legacy files
src/components/ui.tsx         ← 22KB monolith (8 dead exports, 5 live)
src/hooks/v2/                ← 2 hooks + barrel
```

**After:**
```
src/components/shared/            ← Multi-screen: LoadingState, Avatar, ChallengeCard, etc.
src/components/home/              ← Home screen: ExpandableChallengeCard, StreakBanner, etc.
src/components/create-challenge/  ← Wizard: StepType, StepDetails, StepInvite, etc.
src/components/challenge-detail/  ← Detail: HeaderCard, LeaderboardSection, etc.
src/components/notifications/     ← Notifications: NotificationsScreen, NotificationRow
src/hooks/useChallengeFilters.ts  ← Merged from hooks/v2/
src/hooks/useHomeScreenData.ts    ← Merged from hooks/v2/
```

## Bug Found & Fixed

**ChallengeDetailScreen naming collision** — The original code had `ChallengeDetailScreenV2` (component) vs `ChallengeDetailScreen` (route function), which avoided shadowing. Removing the V2 suffix caused the import to be shadowed by the route function → infinite recursion at runtime. Fixed by renaming the route function to `ChallengeDetailRoute`.

---

## Step-by-Step Process

### Step 1: Copy New Directories

Copy these 5 directories from `phase4-deliverable/src/components/` into your project's `src/components/`:

```bash
cp -r phase4-deliverable/src/components/shared/     src/components/shared/
cp -r phase4-deliverable/src/components/home/        src/components/home/
cp -r phase4-deliverable/src/components/create-challenge/ src/components/create-challenge/
cp -r phase4-deliverable/src/components/challenge-detail/ src/components/challenge-detail/
cp -r phase4-deliverable/src/components/notifications/    src/components/notifications/
```

Copy the 2 hooks + test:

```bash
cp phase4-deliverable/src/hooks/useChallengeFilters.ts  src/hooks/
cp phase4-deliverable/src/hooks/useHomeScreenData.ts    src/hooks/
cp -r phase4-deliverable/src/hooks/__tests__/           src/hooks/__tests__/
```

Copy the fixed route file:

```bash
cp phase4-deliverable/app/challenge/\[id\].tsx  app/challenge/\[id\].tsx
```

### Step 2: Delete Dead Code

```bash
# Dead legacy shared/ files (replaced by v2 components now in shared/)
rm -f src/components/shared/AnimatedCard.tsx
rm -f src/components/shared/Button.tsx
rm -f src/components/shared/FilterDropdown.tsx
rm -f src/components/shared/HealthBadge.tsx
rm -f src/components/shared/ProgressRing.tsx
rm -f src/components/shared/StreakBanner.tsx

# ui.tsx monolith (Avatar, ProgressBar, LoadingScreen extracted to shared/)
rm -f src/components/ui.tsx

# Old root NotificationsScreen (replaced by notifications/)
rm -f src/components/NotificationsScreen.tsx
```

### Step 3: Delete Old v2 Directories

```bash
rm -rf src/components/v2
rm -rf src/components/challenge-detail-v2
rm -rf src/hooks/v2
```

### Step 4: Update Import Paths

These are the exact import changes needed in your `app/` files.

#### `app/(tabs)/index.tsx`

| Old | New |
|-----|-----|
| `from "@/hooks/v2"` | Split into two imports (see below) |
| `from "@/components/v2"` | `from "@/components/shared"` |
| `from "@/components/v2/Toast"` | `from "@/components/shared/Toast"` |

The hooks barrel import needs to be split:
```typescript
// OLD:
import { useHomeScreenData, useChallengeFilters } from "@/hooks/v2";

// NEW:
import { useHomeScreenData } from "@/hooks/useHomeScreenData";
import { useChallengeFilters } from "@/hooks/useChallengeFilters";
```

The component import needs home barrel added:
```typescript
// OLD: everything from @/components/v2
// NEW: shared components from @/components/shared, home components from @/components/home
```

Check what you import from `@/components/v2` — split them between `@/components/shared` (LoadingState, EmptyState, ChallengeCard, etc.) and `@/components/home` (ExpandableChallengeCard, SectionHeader, StreakBanner, etc.).

#### `app/(tabs)/challenges.tsx`

| Old | New |
|-----|-----|
| `from "@/components/v2"` | `from "@/components/shared"` |

#### `app/(tabs)/friends.tsx`

| Old | New |
|-----|-----|
| `from "@/components/v2"` | `from "@/components/shared"` |

#### `app/(tabs)/profile.tsx`

| Old | New |
|-----|-----|
| `from "@/components/ui"` | `from "@/components/shared"` |

#### `app/challenge/[id].tsx`

**Already replaced in Step 1** — the delivered file has all imports updated + the naming collision fix.

#### `app/challenge/create.tsx`

| Old | New |
|-----|-----|
| `from "@/components/v2/create"` | `from "@/components/create-challenge"` |

#### `app/activity/index.tsx`

| Old | New |
|-----|-----|
| `from "@/components/v2"` | `from "@/components/shared"` |
| `from "@/components/v2/ActivityCard"` | `from "@/components/shared/ActivityCard"` |

#### `app/activity/[id].tsx`

| Old | New |
|-----|-----|
| `from "@/components/v2"` | `from "@/components/shared"` |

#### `app/invite/[id].tsx`

| Old | New |
|-----|-----|
| `from "@/components/v2"` | `from "@/components/shared"` |

#### `app/notifications.tsx`

| Old | New |
|-----|-----|
| `import { V2NotificationsScreen } from "@/components/v2"` | `import { NotificationsScreen } from "@/components/notifications"` |

Also update the JSX: `<V2NotificationsScreen />` → `<NotificationsScreen />`

#### `app/_layout.tsx`

| Old | New |
|-----|-----|
| `{ ServerTimeBanner, OfflineIndicator } from "@/components/ui"` | `{ ServerTimeBanner } from "@/components/ServerTimeBanner"` + `{ OfflineIndicator } from "@/components/OfflineIndicator"` |

#### Test file: `src/__tests__/component/notifications.component.test.tsx`

| Old | New |
|-----|-----|
| `from "@/components/v2"` | `from "@/components/notifications"` |
| `V2NotificationsScreen` | `NotificationsScreen` |

### Step 5: Verify

```bash
# TypeScript catches ALL missed imports
npx tsc --noEmit

# Quick grep — should return NOTHING
grep -rn "v2" --include="*.tsx" --include="*.ts" src/ app/ | grep -v "node_modules" | grep -v "api/v2" | grep -v "exp.host"

# Run tests
npm test

# Run the app
npx expo start --dev-client --clear
```

---

## What's in Each New Directory

### `shared/` — Multi-screen components
Avatar, ProgressBar, LoadingScreen (extracted from ui.tsx), LoadingState, EmptyState, ErrorState, ChallengeCard, ChallengeFilter, FriendRow, InviteCard, ActivityCard, Toast, UndoToast

### `home/` — Home screen only
ExpandableChallengeCard, LeaderboardPreview, SectionHeader, StartingSoonCard, StreakBanner, ActivityRow

### `create-challenge/` — Challenge creation wizard
CreateChallengeOrchestrator, StepMode, StepType, StepWorkoutPicker, StepDetails, StepInvite, StepReview, StepSuccess, StepProgress, types

### `challenge-detail/` — Challenge detail screen
ChallengeDetailScreen, HeaderCard, ChallengeInfoSection, LeaderboardSection, YourActivitySection, LogActivitySheet, InviteModal, MoreMenu, CompletedBanner, PendingInviteBanner, helpers, types

### `notifications/` — Notifications inbox
NotificationsScreen, NotificationRow, NotificationFilters
