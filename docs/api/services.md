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

### getMyActiveChallenges()

Get challenges where the current user is an accepted participant.

```typescript
const challenges = await challengeService.getMyActiveChallenges();
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

### inviteUser(input)

Invite a user to a challenge. Only the creator can invite.

```typescript
await challengeService.inviteUser({ challenge_id: "challenge-uuid", user_id: "user-uuid" });
```

### respondToInvite(input)

Accept or decline a challenge invitation.

```typescript
await challengeService.respondToInvite({ challenge_id: "challenge-uuid", response: "accepted" });
await challengeService.respondToInvite({ challenge_id: "challenge-uuid", response: "declined" });
```

## Activity Service

```typescript
import { activityService } from "@/services/activities";
```

### logActivity(input)

Log a manual activity entry.

```typescript
await activityService.logActivity({
  challenge_id: "challenge-uuid",
  activity_type: "steps",
  value: 1000,
  client_event_id: randomUUID(),
});
```

### logWorkout(input)

Log a workout with type-specific scoring. Uses the `log_workout` RPC which validates `workout_type` against `allowed_workout_types`, looks up the multiplier from `workout_type_catalog`, and calculates `points = floor(duration × multiplier)`.

```typescript
await activityService.logWorkout({
  challenge_id: "challenge-uuid",
  workout_type: "yoga",
  duration_minutes: 30,
  client_event_id: randomUUID(),
});
// Online: calls log_workout RPC with server-synced timestamp
// Offline: queues as LOG_WORKOUT, replays through log_workout RPC when online
```

**Important:** Workouts go through a different scoring path than generic activities. The `log_workout` RPC applies workout-type multipliers (e.g., yoga 1.5×, running 2.0×), while `log_activity` treats the value as raw points.

### getChallengeActivities(challengeId, limit?)

Get activity history for a specific challenge.

```typescript
const activities = await activityService.getChallengeActivities("challenge-uuid", 50);
```

## Friends Service

```typescript
import { friendsService } from "@/services/friends";
```

### getFriends()

Get all accepted friendships for the current user.

```typescript
const friends = await friendsService.getFriends();
// Returns friendship with requester and recipient profile data
```

### getPendingRequests()

Get pending friend requests received by the current user.

```typescript
const requests = await friendsService.getPendingRequests();
```

### sendRequest(input)

Send a friend request. Checks for existing relationships.

```typescript
await friendsService.sendRequest({ target_user_id: "user-uuid" });
```

### acceptRequest(input)

Accept a friend request. Only the recipient can accept.

```typescript
await friendsService.acceptRequest({ friendship_id: "friendship-uuid" });
```

### declineRequest(input)

Decline a friend request. Only the recipient can decline.

```typescript
await friendsService.declineRequest({ friendship_id: "friendship-uuid" });
```

### removeFriend(input)

Remove a friendship. Either party can remove.

```typescript
await friendsService.removeFriend({ friendship_id: "friendship-uuid" });
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
import { extractErrorMessage } from "@/lib/extractErrorMessage";

try {
  await challengeService.create(input);
} catch (err: unknown) {
  if (err instanceof ValidationError) {
    // Input validation failed
    console.log(err.firstError);
    console.log(err.getFieldError("title"));
  } else if ((err as Record<string, unknown>)?.code === "PGRST116") {
    // Row not found (404)
  } else if ((err as Record<string, unknown>)?.code === "42501") {
    // RLS policy violation (403)
  } else {
    // Other database or network error
    console.error(extractErrorMessage(err));
  }
}
```

### extractErrorMessage utility

All catch blocks use `catch (err: unknown)` (never `catch (err: any)`). Use the shared utility for safe message extraction:

```typescript
import { extractErrorMessage } from "@/lib/extractErrorMessage";

// Returns err.message for Error instances, the string itself for strings,
// or "An unexpected error occurred" for anything else.
const message = extractErrorMessage(err);
```

## Offline Support

Services that support offline operations:

| Service                          | Offline Support | Queue Action Type    | Notes                                        |
| -------------------------------- | --------------- | -------------------- | -------------------------------------------- |
| activityService.logActivity      | ✅ Queued       | `LOG_ACTIVITY`       | Syncs when online via `log_activity` RPC     |
| activityService.logWorkout       | ✅ Queued       | `LOG_WORKOUT`        | Syncs when online via `log_workout` RPC      |
| friendsService.sendRequest       | ✅ Queued       | `SEND_FRIEND_REQUEST`| Syncs when online                            |
| challengeService.respondToInvite | ✅ Queued       | `ACCEPT_INVITE`      | Syncs when online                            |
| challengeService.create          | ❌ Online only  | —                    | Requires server validation                   |
| healthService.sync               | ❌ Online only  | —                    | Requires API access                          |

All queued actions are idempotent via `client_event_id`. The offline store captures `queuedByUserId` at enqueue time and drops items from a different user at processing time (cross-account guard).

```typescript
import { useOfflineStore } from "@/stores/offlineStore";

const { addToQueue, processQueue, queue } = useOfflineStore();

// Queue a generic activity when offline
addToQueue({
  type: "LOG_ACTIVITY",
  payload: { challengeId, value, activityType, clientEventId },
});

// Queue a workout when offline (preserves scoring path)
addToQueue({
  type: "LOG_WORKOUT",
  payload: {
    challenge_id: "challenge-uuid",
    workout_type: "yoga",
    duration_minutes: 30,
    client_event_id: randomUUID(),
  },
});

// Process queue when back online
await processQueue();
```
