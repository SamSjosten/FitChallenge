# Service API Reference

This document describes the TypeScript service layer APIs.

## Overview

All services follow these patterns:

- Input validation with Zod schemas
- Database operations via Supabase client
- Consistent error handling
- RLS-enforced authorization (no client-side auth checks)

## Challenge Service

```typescript
import { challengeService } from "@/services/challenges";
```

### create(input)

Create a new challenge. Creator is automatically added as accepted participant.

```typescript
const challenge = await challengeService.create({
  title: "10K Steps Challenge",
  description: "Walk 10,000 steps daily",
  challenge_type: "steps",
  goal_value: 70000,
  goal_unit: "steps",
  win_condition: "highest_total",
  start_date: "2024-01-15T00:00:00Z",
  end_date: "2024-01-22T00:00:00Z",
});
```

### getMyActive()

Get challenges where the current user is an accepted participant.

```typescript
const challenges = await challengeService.getMyActive();
```

### getPendingInvites()

Get challenges where the current user has a pending invitation.

```typescript
const invites = await challengeService.getPendingInvites();
```

### getLeaderboard(challengeId)

Get the leaderboard for a challenge. Only shows accepted participants.

```typescript
const leaderboard = await challengeService.getLeaderboard("uuid-here");
// Returns: Array<{ user_id, current_progress, profiles_public }>
```

### inviteUser(challengeId, targetUserId)

Invite a user to a challenge. Only the creator can invite.

```typescript
await challengeService.inviteUser("challenge-uuid", "user-uuid");
```

### respondToInvite(challengeId, response)

Accept or decline a challenge invitation.

```typescript
await challengeService.respondToInvite("challenge-uuid", "accepted");
await challengeService.respondToInvite("challenge-uuid", "declined");
```

### logActivity(input)

Log activity for a challenge. Uses atomic database function for idempotency.

```typescript
import { randomUUID } from "expo-crypto";

await challengeService.logActivity({
  challenge_id: "challenge-uuid",
  activity_type: "steps",
  value: 5000,
  client_event_id: randomUUID(), // Required for idempotency
});
```

## Activity Service

```typescript
import { activityService } from "@/services/activities";
```

### logManual(input)

Log a manual activity entry.

```typescript
await activityService.logManual({
  challenge_id: "challenge-uuid",
  activity_type: "steps",
  value: 1000,
  client_event_id: randomUUID(),
  recorded_at: new Date().toISOString(), // Optional
});
```

### getHistory(options)

Get activity history for the current user.

```typescript
const activities = await activityService.getHistory({
  limit: 50,
  offset: 0,
  challenge_id: "optional-filter",
});
```

## Friends Service

```typescript
import { friendsService } from "@/services/friends";
```

### getAll()

Get all accepted friendships for the current user.

```typescript
const friends = await friendsService.getAll();
// Returns friendship with requester and recipient profile data
```

### getPendingReceived()

Get pending friend requests received by the current user.

```typescript
const requests = await friendsService.getPendingReceived();
```

### getPendingSent()

Get pending friend requests sent by the current user.

```typescript
const requests = await friendsService.getPendingSent();
```

### sendRequest(targetUserId)

Send a friend request. Checks for existing relationships.

```typescript
await friendsService.sendRequest("target-user-uuid");
```

### acceptRequest(friendshipId)

Accept a friend request. Only the recipient can accept.

```typescript
await friendsService.acceptRequest("friendship-uuid");
```

### declineRequest(friendshipId)

Decline a friend request. Only the recipient can decline.

```typescript
await friendsService.declineRequest("friendship-uuid");
```

### removeFriendship(friendshipId)

Remove a friendship. Either party can remove.

```typescript
await friendsService.removeFriendship("friendship-uuid");
```

## Health Service

```typescript
import { getHealthService } from "@/services/health";

const healthService = getHealthService();
```

### getConnectionStatus()

Get the current health provider connection status.

```typescript
const { status, connection, lastSync } =
  await healthService.getConnectionStatus();
// status: 'connected' | 'disconnected' | 'syncing' | 'error'
```

### connect(permissions?)

Connect to the health provider and request permissions.

```typescript
const connection = await healthService.connect([
  "steps",
  "activeMinutes",
  "calories",
]);
```

### disconnect()

Disconnect from the health provider.

```typescript
await healthService.disconnect();
```

### sync(options?)

Sync health data from the provider.

```typescript
const result = await healthService.sync({
  syncType: "manual", // 'background' | 'manual' | 'initial'
  lookbackDays: 7, // How far back to fetch
  activityTypes: ["steps", "calories"],
  force: false, // Force re-sync
});

// result: {
//   success: boolean,
//   syncLogId: string,
//   recordsProcessed: number,
//   recordsInserted: number,
//   recordsDeduplicated: number,
//   errors: string[],
//   duration: number,
// }
```

### getSyncHistory(limit?)

Get recent sync operation logs.

```typescript
const logs = await healthService.getSyncHistory(10);
```

### getRecentActivities(limit?, offset?)

Get recently synced health activities.

```typescript
const activities = await healthService.getRecentActivities(50, 0);
```

## Auth Service

```typescript
import { useAuth } from "@/hooks/useAuth";

const { user, signIn, signUp, signOut, signInWithApple } = useAuth();
```

### signUp(email, password, username)

Create a new account. Profile is created automatically.

```typescript
await signUp("user@example.com", "password123", "username");
```

### signIn(email, password)

Sign in with email and password.

```typescript
await signIn("user@example.com", "password123");
```

### signInWithApple()

Sign in with Apple (iOS only).

```typescript
await signInWithApple();
```

### signOut()

Sign out the current user.

```typescript
await signOut();
```

## Error Handling

All services may throw these error types:

```typescript
import { ValidationError } from "@/lib/validation";

try {
  await challengeService.create(input);
} catch (error) {
  if (error instanceof ValidationError) {
    // Input validation failed
    console.log(error.firstError);
    console.log(error.getFieldError("title"));
  } else if (error.code === "PGRST116") {
    // Row not found (404)
  } else if (error.code === "42501") {
    // RLS policy violation (403)
  } else {
    // Other database or network error
    console.error(error.message);
  }
}
```

## Offline Support

Services that support offline operations:

| Service                          | Offline Support | Notes                      |
| -------------------------------- | --------------- | -------------------------- |
| challengeService.logActivity     | ✅ Queued       | Syncs when online          |
| friendsService.sendRequest       | ✅ Queued       | Syncs when online          |
| challengeService.respondToInvite | ✅ Queued       | Syncs when online          |
| challengeService.create          | ❌ Online only  | Requires server validation |
| healthService.sync               | ❌ Online only  | Requires API access        |

Use the offline store for queued operations:

```typescript
import { useOfflineStore } from "@/stores/offlineStore";

const { addToQueue, processQueue, queue } = useOfflineStore();

// Queue an action when offline
addToQueue({
  type: "LOG_ACTIVITY",
  payload: { challengeId, value, activityType, clientEventId },
});

// Process queue when back online
await processQueue();
```
