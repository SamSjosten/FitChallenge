# Component Library

> **Last Updated:** February 2025

This document describes the reusable React Native components in FitChallenge.

## Overview

Components are organized into:

- **Shared** (`src/components/shared/`) — Design system primitives
- **V2** (`src/components/v2/`) — V2-specific components
- **Legacy** (`src/components/`) — V1 components (to be deprecated)

---

## Shared Components

Located in `src/components/shared/`.

### Button

Primary action button with variants.

```typescript
import { Button } from '@/components/shared/Button';

<Button
  variant="primary" | "secondary" | "outline" | "ghost"
  size="sm" | "md" | "lg"
  loading={false}
  disabled={false}
  onPress={() => {}}
>
  Button Text
</Button>
```

### EmptyState

Displayed when lists have no items.

```typescript
import { EmptyState } from '@/components/shared/EmptyState';

<EmptyState
  icon="trophy" | "users" | "activity" | "bell"
  title="No challenges yet"
  description="Create your first challenge to get started"
  actionLabel="Create Challenge"
  onAction={() => {}}
/>
```

### ProgressRing

Circular progress indicator.

```typescript
import { ProgressRing } from '@/components/shared/ProgressRing';

<ProgressRing
  progress={0.75}        // 0-1
  size={80}
  strokeWidth={8}
  color="#10B981"
  backgroundColor="#E5E7EB"
  showPercentage={true}
/>
```

### StreakBanner

Displays user's activity streak.

```typescript
import { StreakBanner } from '@/components/shared/StreakBanner';

<StreakBanner
  currentStreak={7}
  longestStreak={14}
  lastActivityDate={new Date()}
/>
```

### ActivityCard

Displays a single activity log entry.

```typescript
import { ActivityCard } from '@/components/shared/ActivityCard';

<ActivityCard
  activityType="steps"
  value={5000}
  unit="steps"
  recordedAt={new Date()}
  source="manual" | "healthkit" | "googlefit"
  challengeTitle="Step Challenge"  // optional
/>
```

### HealthBadge

Shows health provider connection status.

```typescript
import { HealthBadge } from '@/components/shared/HealthBadge';

<HealthBadge
  provider="healthkit" | "googlefit"
  status="connected" | "disconnected" | "syncing" | "error"
  lastSync={new Date()}
  onPress={() => {}}
/>
```

### FilterDropdown

Dropdown for filtering lists.

```typescript
import { FilterDropdown } from '@/components/shared/FilterDropdown';

<FilterDropdown
  options={[
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
  ]}
  value="all"
  onChange={(value) => {}}
/>
```

### AnimatedCard

Card with entrance animation.

```typescript
import { AnimatedCard } from '@/components/shared/AnimatedCard';

<AnimatedCard
  delay={100}           // ms before animation starts
  duration={300}        // animation duration
  style={customStyles}
>
  <ChildContent />
</AnimatedCard>
```

---

## V2 Components

Located in `src/components/v2/`.

### State Components

#### LoadingState

```typescript
import { LoadingState } from '@/components/v2/LoadingState';

<LoadingState message="Loading challenges..." />
```

#### ErrorState

```typescript
import { ErrorState } from '@/components/v2/ErrorState';

<ErrorState
  message="Failed to load data"
  onRetry={() => refetch()}
/>
```

### Challenge Components

#### ChallengeCard

```typescript
import { ChallengeCard } from '@/components/v2/ChallengeCard';

<ChallengeCard
  challenge={challenge}
  onPress={() => navigate(`/challenge/${challenge.id}`)}
/>
```

#### InviteCard

```typescript
import { InviteCard } from '@/components/v2/InviteCard';

<InviteCard
  invite={invite}
  onAccept={() => acceptInvite(invite.id)}
  onDecline={() => declineInvite(invite.id)}
/>
```

#### CompletedChallengeRow

```typescript
import { CompletedChallengeRow } from '@/components/v2/CompletedChallengeRow';

<CompletedChallengeRow
  challenge={challenge}
  finalRank={2}
  onPress={() => {}}
/>
```

### Friend Components

#### FriendRow

```typescript
import { FriendRow } from '@/components/v2/FriendRow';

<FriendRow
  friend={friend}
  onPress={() => viewProfile(friend.id)}
  onRemove={() => removeFriend(friend.id)}
/>
```

#### FriendRequestRow

```typescript
import { FriendRequestRow } from '@/components/v2/FriendRequestRow';

<FriendRequestRow
  request={request}
  onAccept={() => acceptRequest(request.id)}
  onDecline={() => declineRequest(request.id)}
/>
```

#### SearchResultRow

```typescript
import { SearchResultRow } from '@/components/v2/SearchResultRow';

<SearchResultRow
  user={user}
  isFriend={false}
  isPending={false}
  onAddFriend={() => sendRequest(user.id)}
/>
```

### Activity Components

#### ActivityRow

```typescript
import { ActivityRow } from '@/components/v2/ActivityRow';

<ActivityRow
  activity={activity}
  showChallenge={true}
/>
```

#### ActivityListItem

Compact version for lists.

```typescript
import { ActivityListItem } from '@/components/v2/ActivityListItem';

<ActivityListItem activity={activity} />
```

### Notification Components

#### NotificationRow

```typescript
import { NotificationRow } from '@/components/v2/NotificationRow';

<NotificationRow
  notification={notification}
  onPress={() => handleNotification(notification)}
  onArchive={() => archive(notification.id)}
/>
```

### UI Components

#### Toast

```typescript
import { Toast } from '@/components/v2/Toast';

<Toast
  visible={showToast}
  message="Challenge created!"
  type="success" | "error" | "info"
  onDismiss={() => setShowToast(false)}
/>
```

#### ChallengeFilter

```typescript
import { ChallengeFilter } from '@/components/v2/ChallengeFilter';

<ChallengeFilter
  value="active"
  onChange={(filter) => setFilter(filter)}
/>
```

---

## Design Tokens

### Colors

```typescript
// src/constants/theme.ts
export const colors = {
  primary: "#10B981", // Emerald 500
  primaryDark: "#059669", // Emerald 600
  secondary: "#6366F1", // Indigo 500

  text: {
    primary: "#1F2937", // Gray 800
    secondary: "#6B7280", // Gray 500
    inverse: "#FFFFFF",
  },

  background: {
    primary: "#FFFFFF",
    secondary: "#F9FAFB", // Gray 50
    tertiary: "#F3F4F6", // Gray 100
  },

  status: {
    success: "#10B981",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#3B82F6",
  },
};
```

### Spacing

```typescript
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};
```

### Typography

```typescript
export const typography = {
  fontFamily: {
    regular: "PlusJakartaSans-Regular",
    medium: "PlusJakartaSans-Medium",
    semibold: "PlusJakartaSans-SemiBold",
    bold: "PlusJakartaSans-Bold",
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
};
```

### Border Radius

```typescript
export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};
```

---

## Component Testing

All shared components have tests in `src/__tests__/component/shared/`:

```bash
npm run test:component -- --testPathPattern="shared"
```

Example test:

```typescript
// src/__tests__/component/shared/Button.component.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '@/components/shared/Button';

describe('Button', () => {
  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Button onPress={onPress}>Click me</Button>
    );

    fireEvent.press(getByText('Click me'));
    expect(onPress).toHaveBeenCalled();
  });

  it('shows loading indicator when loading', () => {
    const { getByTestId } = render(
      <Button loading>Submit</Button>
    );

    expect(getByTestId('loading-indicator')).toBeTruthy();
  });
});
```

---

## Related Documents

- [Architecture Overview](../architecture/overview.md) — Layer responsibilities
- [Feature Flags](../architecture/feature-flags.md) — V1/V2 switching
- [UI Migration Guide](../guides/ui-migration.md) — Migration patterns
