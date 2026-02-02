# React Hooks API

> **Last Updated:** February 2025

This document describes the custom React hooks available in FitChallenge.

## Overview

Hooks are organized by domain:

- **Auth** — Authentication and user session
- **Data** — React Query hooks for server state
- **Health** — HealthKit/Google Fit integration
- **UI** — Feature flags and UI state

---

## Auth Hooks

### useAuth

Authentication state and methods.

**Location:** `src/hooks/useAuth.ts`

```typescript
const {
  session, // Supabase session or null
  user, // Supabase user or null
  loading, // True while checking auth
  error, // Auth error or null
  signUp, // (email, password, username) => Promise<void>
  signIn, // (email, password) => Promise<void>
  signInWithApple, // () => Promise<void>
  signOut, // () => Promise<void>
  clearError, // () => void
} = useAuth();
```

### useBiometricAuth

<!-- TODO: Document biometric auth hook -->

**Location:** `src/hooks/useBiometricAuth.ts`

---

## Data Hooks

### useChallenges

Challenge list and filtering.

**Location:** `src/hooks/useChallenges.ts`

```typescript
const {
  activeChallenges, // Challenge[] — currently active
  pendingChallenges, // Challenge[] — awaiting start
  completedChallenges, // Challenge[] — finished
  pendingInvites, // ChallengeInvite[] — received invites
  isLoading,
  error,
  refetch,
} = useChallenges();
```

### useChallengeDetail

Single challenge with participants and leaderboard.

**Location:** `src/hooks/useChallengeDetail.ts`

```typescript
const {
  challenge, // Challenge | null
  participants, // Participant[]
  leaderboard, // LeaderboardEntry[]
  myProgress, // number
  isLoading,
  error,
  refetch,
} = useChallengeDetail(challengeId);
```

### useFriends

Friends list and requests.

**Location:** `src/hooks/useFriends.ts`

```typescript
const {
  friends, // Friend[] — accepted friendships
  pendingReceived, // FriendRequest[] — received requests
  pendingSent, // FriendRequest[] — sent requests
  isLoading,
  error,
  sendRequest, // (userId: string) => Promise<void>
  acceptRequest, // (requestId: string) => Promise<void>
  declineRequest, // (requestId: string) => Promise<void>
  removeFriend, // (friendshipId: string) => Promise<void>
} = useFriends();
```

### useNotifications

In-app notifications.

**Location:** `src/hooks/useNotifications.ts`

```typescript
const {
  notifications, // Notification[]
  unreadCount, // number
  isLoading,
  error,
  markAsRead, // (id: string) => Promise<void>
  markAllAsRead, // () => Promise<void>
  archive, // (id: string) => Promise<void>
  refetch,
} = useNotifications();
```

### useProfile

Current user's profile.

**Location:** `src/hooks/useProfile.ts`

```typescript
const {
  profile, // Profile | null
  isLoading,
  error,
  updateProfile, // (updates: Partial<Profile>) => Promise<void>
  refetch,
} = useProfile();
```

---

## Health Hooks

### useHealthConnection

Health provider connection status.

**Location:** `src/services/health/hooks/useHealthConnection.ts`

```typescript
const {
  status, // 'connected' | 'disconnected' | 'syncing' | 'error'
  connection, // HealthConnection | null
  lastSync, // Date | null
  isLoading,
  connect, // (permissions?: HealthPermission[]) => Promise<void>
  disconnect, // () => Promise<void>
  refetch,
} = useHealthConnection();
```

### useHealthSync

Manual health data synchronization.

**Location:** `src/services/health/hooks/useHealthSync.ts`

```typescript
const {
  isSyncing, // boolean
  lastResult, // SyncResult | null
  error, // Error | null
  sync, // (options?: SyncOptions) => Promise<SyncResult>
} = useHealthSync();
```

### useHealthData

Recent health activities and sync history.

**Location:** `src/services/health/hooks/useHealthData.ts`

```typescript
const {
  recentActivities, // ProcessedActivity[]
  syncHistory, // HealthSyncLog[]
  isLoading,
  error,
  refetch,
} = useHealthData();
```

---

## UI Hooks

### useFeatureFlags

UI version control.

**Location:** `src/lib/featureFlags.ts`

```typescript
const {
  uiVersion, // 'v1' | 'v2' | null
  isLoading, // boolean
  isV2, // boolean (convenience)
  toggleVersion, // () => Promise<UIVersion>
  setVersion, // (version: UIVersion) => Promise<void>
} = useFeatureFlags();
```

See [Feature Flags Architecture](../architecture/feature-flags.md) for details.

### useNetworkStatus

Online/offline detection.

**Location:** `src/hooks/useNetworkStatus.ts`

```typescript
const {
  isConnected, // boolean
  isInternetReachable, // boolean | null
} = useNetworkStatus();
```

---

## V2 Hooks

### useHomeScreenData

Consolidated data for V2 home screen.

**Location:** `src/hooks/v2/useHomeScreenData.ts`

```typescript
const {
  challenges, // Challenge[]
  pendingInvites, // ChallengeInvite[]
  recentActivity, // ActivityLog[]
  streakData, // StreakInfo
  isLoading,
  error,
  refetch,
} = useHomeScreenData();
```

### useChallengeFilters

Challenge filtering state for V2.

**Location:** `src/hooks/v2/useChallengeFilters.ts`

```typescript
const {
  filter, // 'all' | 'active' | 'pending' | 'completed'
  setFilter, // (filter: FilterType) => void
  filterLabels, // Record<FilterType, string>
} = useChallengeFilters();
```

---

## Query Keys

All React Query hooks use consistent query keys defined in `src/lib/queryClient.ts`:

```typescript
export const queryKeys = {
  challenges: {
    all: ["challenges"],
    active: (userId: string) => ["challenges", "active", userId],
    detail: (id: string) => ["challenges", "detail", id],
    leaderboard: (id: string) => ["challenges", "leaderboard", id],
    pendingInvites: (userId: string) => ["challenges", "invites", userId],
  },
  friends: {
    all: (userId: string) => ["friends", userId],
    pending: (userId: string) => ["friends", "pending", userId],
  },
  profile: {
    me: ["profile", "me"],
  },
  notifications: {
    all: (userId: string) => ["notifications", userId],
    unread: (userId: string) => ["notifications", "unread", userId],
  },
  health: {
    connection: ["health", "connection"],
    syncHistory: ["health", "syncHistory"],
    recentActivities: ["health", "activities"],
  },
};
```

---

## Related Documents

- [Services API](./services.md) — Service layer functions
- [RPC Functions](./rpc-functions.md) — Database functions
- [Architecture Overview](../architecture/overview.md) — Data flow
