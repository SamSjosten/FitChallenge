# Database RPC Functions

> **Last Updated:** February 2025

This document describes the PostgreSQL RPC functions available via Supabase.

## Overview

RPC functions provide:

- **Atomic operations** — Multi-step logic in a single transaction
- **Server-side validation** — Business rules enforced at database level
- **Performance** — Complex queries optimized in PostgreSQL
- **Security** — Some functions use `SECURITY DEFINER` for elevated access

## Calling RPCs

```typescript
import { supabase } from "@/lib/supabase";

// Call an RPC function
const { data, error } = await supabase.rpc("function_name", {
  p_param1: value1,
  p_param2: value2,
});
```

---

## Challenge Functions

### create_challenge_atomic

Creates a challenge and adds creator as accepted participant atomically.

**Source:** Migration 014

```sql
create_challenge_atomic(
  p_title text,
  p_description text,
  p_challenge_type challenge_type,
  p_goal_value integer,
  p_goal_unit text,
  p_win_condition win_condition,
  p_daily_target integer,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_custom_activity_name text DEFAULT NULL
) RETURNS uuid
```

**Returns:** Challenge ID

**Example:**

```typescript
const { data: challengeId } = await supabase.rpc("create_challenge_atomic", {
  p_title: "Step Challenge",
  p_challenge_type: "steps",
  p_goal_value: 10000,
  p_goal_unit: "steps",
  p_win_condition: "highest_total",
  p_start_date: "2025-02-01T00:00:00Z",
  p_end_date: "2025-02-28T23:59:59Z",
});
```

### invite_to_challenge

Invites a user to a challenge (creator only).

**Source:** Migration 015

```sql
invite_to_challenge(
  p_challenge_id uuid,
  p_user_id uuid
) RETURNS void
```

**Errors:**

- `challenge_not_found` — Invalid challenge ID
- `not_creator` — Caller is not the challenge creator
- `already_participant` — User already has a participation record

### respond_to_invite

Accepts or declines a challenge invitation.

**Source:** Migration 027

```sql
respond_to_invite(
  p_challenge_id uuid,
  p_response text  -- 'accepted' | 'declined'
) RETURNS void
```

**Errors:**

- `no_pending_invite` — No pending invitation for this user

### get_challenge_data

Returns challenge details with computed status and user's participation.

**Source:** Migration 018

```sql
get_challenge_data(
  p_challenge_id uuid
) RETURNS jsonb
```

**Returns:**

```json
{
  "challenge": { ... },
  "effective_status": "active",
  "my_participation": { ... },
  "participant_count": 5
}
```

### get_challenge_effective_status

Computes challenge status based on time boundaries.

**Source:** Migration 009

```sql
get_challenge_effective_status(
  p_challenge_id uuid,
  p_server_now timestamptz DEFAULT now()
) RETURNS text
```

**Returns:** `'pending'` | `'active'` | `'completed'` | `'cancelled'` | `'archived'`

### get_leaderboard

Returns ranked participants for a challenge.

**Source:** Migration 019

```sql
get_leaderboard(
  p_challenge_id uuid
) RETURNS TABLE (
  rank bigint,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  current_progress integer,
  current_streak integer,
  completed boolean
)
```

---

## Activity Functions

### log_activity

Logs activity and updates participant progress atomically.

**Source:** Migration 011

```sql
log_activity(
  p_challenge_id uuid,
  p_activity_type text,
  p_value integer,
  p_recorded_at timestamptz,
  p_source text,
  p_client_event_id uuid DEFAULT NULL,
  p_source_external_id text DEFAULT NULL
) RETURNS void
```

**Errors:**

- `challenge_not_active` — Challenge is archived/completed/cancelled
- `not_participant` — Caller is not an accepted participant
- Duplicate `client_event_id` — Silently ignored (idempotency)

**Example:**

```typescript
const clientEventId = crypto.randomUUID();
await supabase.rpc("log_activity", {
  p_challenge_id: challengeId,
  p_activity_type: "steps",
  p_value: 5000,
  p_recorded_at: new Date().toISOString(),
  p_source: "manual",
  p_client_event_id: clientEventId,
});
```

### get_activity_summary

Returns aggregated activity stats for a user.

**Source:** Migration 010

```sql
get_activity_summary(
  p_user_id uuid,
  p_start_date date,
  p_end_date date
) RETURNS TABLE (
  activity_type challenge_type,
  total_value bigint,
  entry_count bigint
)
```

---

## Health Functions

### log_health_activity

Batch inserts health activities with deduplication.

**Source:** Migration 024

```sql
log_health_activity(
  p_activities jsonb  -- Array of activity objects
) RETURNS jsonb
```

**Input format:**

```json
[
  {
    "activity_type": "steps",
    "value": 5000,
    "unit": "count",
    "source": "healthkit",
    "source_external_id": "sha256-hash",
    "recorded_at": "2025-01-15T10:00:00Z",
    "challenge_id": "uuid-or-null"
  }
]
```

**Returns:**

```json
{
  "inserted": 10,
  "deduplicated": 2,
  "total_processed": 12,
  "errors": []
}
```

### connect_health_provider

Records a health provider connection.

**Source:** Migration 023

```sql
connect_health_provider(
  p_provider text,           -- 'healthkit' | 'googlefit'
  p_permissions text[]       -- Granted permissions
) RETURNS uuid               -- Connection ID
```

### disconnect_health_provider

Disconnects a health provider.

**Source:** Migration 023

```sql
disconnect_health_provider(
  p_provider text
) RETURNS void
```

### get_health_connection

Returns current health connection status.

**Source:** Migration 023

```sql
get_health_connection(
  p_provider text
) RETURNS TABLE (
  id uuid,
  user_id uuid,
  provider text,
  connected_at timestamptz,
  last_sync_at timestamptz,
  permissions_granted text[],
  is_active boolean
)
```

### start_health_sync

Starts a health sync session (creates log entry).

**Source:** Migration 024

```sql
start_health_sync(
  p_provider text,
  p_sync_type text  -- 'background' | 'manual' | 'initial'
) RETURNS uuid      -- Sync log ID
```

### complete_health_sync

Completes a health sync session with results.

**Source:** Migration 024

```sql
complete_health_sync(
  p_log_id uuid,
  p_status text,              -- 'completed' | 'failed' | 'partial'
  p_records_processed integer,
  p_records_inserted integer,
  p_records_deduplicated integer,
  p_error_message text DEFAULT NULL
) RETURNS void
```

### get_challenges_for_health_sync

Returns active challenges for health activity attribution.

**Source:** Migration 024

```sql
get_challenges_for_health_sync() RETURNS TABLE (
  challenge_id uuid,
  challenge_type challenge_type,
  start_date timestamptz,
  end_date timestamptz,
  goal_value integer,
  current_progress integer
)
```

---

## Notification Functions

### mark_notification_read

Marks a single notification as read.

**Source:** Migration 016

```sql
mark_notification_read(
  p_notification_id uuid
) RETURNS void
```

### mark_all_notifications_read

Marks all user's notifications as read.

**Source:** Migration 016

```sql
mark_all_notifications_read() RETURNS void
```

### archive_notification

Archives a notification.

**Source:** Migration 028

```sql
archive_notification(
  p_notification_id uuid
) RETURNS void
```

### enqueue_challenge_invite_notification

Creates a notification for a challenge invite (server-side).

**Source:** Migration 005

```sql
enqueue_challenge_invite_notification(
  p_challenge_id uuid,
  p_invited_user_id uuid
) RETURNS void
```

**Note:** This is a `SECURITY DEFINER` function — only callable when the auth user is the challenge creator.

---

## Utility Functions

### get_server_time

Returns current server timestamp.

**Source:** Migration 012

```sql
get_server_time() RETURNS timestamptz
```

**Example:**

```typescript
const { data: serverTime } = await supabase.rpc("get_server_time");
// Use for time-sensitive comparisons
```

### get_pending_invites_with_creators

Returns pending challenge invites with creator profiles.

**Source:** Migration 017

```sql
get_pending_invites_with_creators() RETURNS TABLE (
  challenge_id uuid,
  title text,
  challenge_type challenge_type,
  goal_value integer,
  start_date timestamptz,
  end_date timestamptz,
  creator_id uuid,
  creator_username text,
  creator_display_name text,
  creator_avatar_url text,
  invited_at timestamptz
)
```

---

## RLS Helper Functions

These functions prevent infinite recursion in RLS policies. See [RLS Policies](../architecture/rls-policies.md).

### check_participant_status

```sql
check_participant_status(
  p_challenge_id uuid,
  p_user_id uuid,
  p_statuses text[]
) RETURNS boolean
```

### is_challenge_creator

```sql
is_challenge_creator(
  p_challenge_id uuid,
  p_user_id uuid
) RETURNS boolean
```

### is_challenge_participant

```sql
is_challenge_participant(
  p_challenge_id uuid,
  p_user_id uuid
) RETURNS boolean
```

---

## Error Handling

RPC functions raise exceptions for error conditions:

```typescript
const { data, error } = await supabase.rpc('log_activity', { ... });

if (error) {
  // error.message contains the exception text
  if (error.message.includes('challenge_not_active')) {
    // Handle inactive challenge
  } else if (error.message.includes('not_participant')) {
    // Handle not a participant
  }
}
```

---

## Related Documents

- [Services API](./services.md) — TypeScript service layer
- [Database Schema](../architecture/database-schema.md) — Table definitions
- [RLS Policies](../architecture/rls-policies.md) — Access control
