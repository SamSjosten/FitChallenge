# Database Schema

> **Last Updated:** February 2025  
> **Migrations:** 001-029

This document describes the FitChallenge PostgreSQL schema, organized by domain.

## Schema Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AUTHENTICATION                                 │
│  ┌─────────────┐                                                            │
│  │ auth.users  │ ◄─── Supabase Auth (managed)                               │
│  └──────┬──────┘                                                            │
│         │ id                                                                │
└─────────┼───────────────────────────────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────────────────────────────┐
│                              USER DOMAIN                                    │
│                                                                             │
│  ┌─────────────────┐         ┌──────────────────┐                           │
│  │    profiles     │ ──────► │  profiles_public │                           │
│  │   (private)     │  sync   │    (public)      │                           │
│  └────────┬────────┘         └──────────────────┘                           │
│           │                                                                 │
│  ┌────────▼────────┐    ┌─────────────────┐    ┌────────────────┐           │
│  │  push_tokens    │    │ consent_records │    │   audit_log    │           │
│  └─────────────────┘    └─────────────────┘    └────────────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            CHALLENGE DOMAIN                                 │
│                                                                             │
│  ┌─────────────────┐                                                        │
│  │   challenges    │                                                        │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│  ┌────────▼────────────────┐    ┌─────────────────┐                         │
│  │ challenge_participants  │    │  activity_logs  │                         │
│  └─────────────────────────┘    └─────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                             SOCIAL DOMAIN                                   │
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐          │
│  │     friends     │    │  notifications  │    │  achievements   │          │
│  │  (directional)  │    │  (server-only)  │    │                 │          │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                             HEALTH DOMAIN                                   │
│                                                                             │
│  ┌──────────────────┐    ┌─────────────────┐                                │
│  │health_connections│    │ health_sync_logs│                                │
│  └──────────────────┘    └─────────────────┘                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Enums

### challenge_type

```sql
CREATE TYPE challenge_type AS ENUM (
  'steps',
  'active_minutes',
  'workouts',
  'distance',
  'calories',  -- Added in migration 022
  'custom'
);
```

### win_condition

```sql
CREATE TYPE win_condition AS ENUM (
  'highest_total',
  'first_to_goal',
  'longest_streak',
  'all_complete'
);
```

### challenge_status

```sql
CREATE TYPE challenge_status AS ENUM (
  'draft',
  'pending',
  'active',
  'completed',
  'archived',
  'cancelled'
);
```

---

## User Domain

### profiles

**Private user data** — accessible only to the user themselves.

| Column                    | Type                       | Description                     |
| ------------------------- | -------------------------- | ------------------------------- |
| id                        | uuid (PK, FK → auth.users) | User ID from Supabase Auth      |
| username                  | text (unique)              | Unique username                 |
| display_name              | text                       | Display name                    |
| avatar_url                | text                       | Avatar image URL                |
| xp_total                  | integer                    | Total experience points         |
| current_streak            | integer                    | Current activity streak         |
| longest_streak            | integer                    | All-time longest streak         |
| last_activity_date        | date                       | Last activity date              |
| is_premium                | boolean                    | Premium subscription status     |
| preferred_language        | text                       | Language preference             |
| timezone                  | text                       | User timezone                   |
| health_setup_completed_at | timestamptz                | When health setup was completed |
| created_at                | timestamptz                | Account creation time           |
| updated_at                | timestamptz                | Last update time                |

**Trigger:** `on_auth_user_created` — Auto-creates profile on signup.

### profiles_public

**Public identity data** — readable by all authenticated users.

| Column       | Type                     | Description           |
| ------------ | ------------------------ | --------------------- |
| id           | uuid (PK, FK → profiles) | User ID               |
| username     | text (unique)            | Username (synced)     |
| display_name | text                     | Display name (synced) |
| avatar_url   | text                     | Avatar URL (synced)   |
| updated_at   | timestamptz              | Last sync time        |

**Trigger:** `trg_sync_profiles_public` — Syncs from profiles on changes.

**Why this split?** See [ADR-001: Privacy Split Architecture](../decisions/ADR-001-parallel-routes.md).

### push_tokens

| Column       | Type                 | Description                 |
| ------------ | -------------------- | --------------------------- |
| id           | uuid (PK)            | Token ID                    |
| user_id      | uuid (FK → profiles) | Owner                       |
| token        | text                 | Push notification token     |
| platform     | text                 | 'ios' / 'android' / 'web'   |
| created_at   | timestamptz          | Registration time           |
| last_seen_at | timestamptz          | Last activity               |
| disabled_at  | timestamptz          | When disabled (soft delete) |

**Constraint:** `UNIQUE(user_id, token)`

### consent_records

| Column          | Type                 | Description     |
| --------------- | -------------------- | --------------- |
| id              | uuid (PK)            | Record ID       |
| user_id         | uuid (FK → profiles) | User            |
| consent_type    | text                 | Type of consent |
| granted         | boolean              | Whether granted |
| consent_version | text                 | Policy version  |
| created_at      | timestamptz          | When recorded   |

**Consent types:** `terms_of_service`, `privacy_policy`, `health_data`, `push_notifications`, `analytics`, `personalized_ads`

### audit_log

| Column     | Type                 | Description                       |
| ---------- | -------------------- | --------------------------------- |
| id         | uuid (PK)            | Log ID                            |
| user_id    | uuid (FK → profiles) | User (nullable for system events) |
| action     | text                 | Action type                       |
| details    | jsonb                | Additional details                |
| created_at | timestamptz          | When logged                       |

---

## Challenge Domain

### challenges

| Column           | Type                 | Description                   |
| ---------------- | -------------------- | ----------------------------- |
| id               | uuid (PK)            | Challenge ID                  |
| creator_id       | uuid (FK → profiles) | Creator (nullable if deleted) |
| title            | text                 | Challenge title               |
| description      | text                 | Description                   |
| challenge_type   | challenge_type       | Activity type                 |
| goal_value       | integer              | Target value                  |
| goal_unit        | text                 | Unit of measurement           |
| win_condition    | win_condition        | How winner is determined      |
| daily_target     | integer              | Optional daily target         |
| start_date       | timestamptz          | Start time                    |
| end_date         | timestamptz          | End time                      |
| status           | challenge_status     | Current status                |
| xp_reward        | integer              | XP for completion             |
| max_participants | integer              | Maximum participants          |
| is_public        | boolean              | Public visibility (future)    |
| created_at       | timestamptz          | Creation time                 |
| updated_at       | timestamptz          | Last update                   |

**Constraints:**

- `end_date > start_date`
- `goal_value > 0`
- `xp_reward BETWEEN 0 AND 10000`

**Status transitions:** See [Architecture Overview](./overview.md#challenge-status-transitions).

### challenge_participants

| Column           | Type                   | Description                                     |
| ---------------- | ---------------------- | ----------------------------------------------- |
| id               | uuid (PK)              | Participation ID                                |
| challenge_id     | uuid (FK → challenges) | Challenge                                       |
| user_id          | uuid (FK → profiles)   | Participant                                     |
| invite_status    | text                   | 'pending' / 'accepted' / 'declined' / 'removed' |
| current_progress | integer                | Aggregated progress                             |
| current_streak   | integer                | Current streak in this challenge                |
| completed        | boolean                | Goal reached                                    |
| completed_at     | timestamptz            | When completed                                  |
| final_rank       | integer                | Final leaderboard position                      |
| joined_at        | timestamptz            | Join/invite time                                |
| updated_at       | timestamptz            | Last update                                     |

**Constraint:** `UNIQUE(challenge_id, user_id)`

### activity_logs

**Append-only activity records.**

| Column             | Type                   | Description                               |
| ------------------ | ---------------------- | ----------------------------------------- |
| id                 | uuid (PK)              | Log ID                                    |
| user_id            | uuid (FK → profiles)   | User                                      |
| challenge_id       | uuid (FK → challenges) | Optional challenge                        |
| activity_type      | challenge_type         | Activity type                             |
| value              | integer                | Amount (can be negative for corrections)  |
| unit               | text                   | Unit of measurement                       |
| source             | text                   | 'manual' / 'healthkit' / 'googlefit'      |
| recorded_at        | timestamptz            | When activity occurred                    |
| created_at         | timestamptz            | When logged (server time)                 |
| client_event_id    | uuid                   | Idempotency key for manual entries        |
| source_external_id | text                   | External ID for health sync deduplication |

**Indexes:**

- `UNIQUE(user_id, client_event_id) WHERE client_event_id IS NOT NULL`
- `UNIQUE(user_id, source, source_external_id) WHERE source_external_id IS NOT NULL`

**Constraint:** `value BETWEEN -10000000 AND 10000000 AND value != 0`

---

## Social Domain

### friends

**Directional friendship model.**

| Column       | Type                 | Description                            |
| ------------ | -------------------- | -------------------------------------- |
| id           | uuid (PK)            | Friendship ID                          |
| requested_by | uuid (FK → profiles) | Requester                              |
| requested_to | uuid (FK → profiles) | Recipient                              |
| status       | text                 | 'pending' / 'accepted' / 'blocked'     |
| created_at   | timestamptz          | Request time                           |
| updated_at   | timestamptz          | Last status change                     |
| user_low     | uuid (generated)     | `LEAST(requested_by, requested_to)`    |
| user_high    | uuid (generated)     | `GREATEST(requested_by, requested_to)` |

**Constraints:**

- `requested_by != requested_to`
- `UNIQUE(requested_by, requested_to)`
- `UNIQUE(user_low, user_high)` — Prevents A→B when B→A exists

### notifications

**Server-created, immutable inbox events.**

| Column       | Type                 | Description            |
| ------------ | -------------------- | ---------------------- |
| id           | uuid (PK)            | Notification ID        |
| user_id      | uuid (FK → profiles) | Recipient              |
| type         | text                 | Notification type      |
| title        | text                 | Display title          |
| body         | text                 | Display body           |
| data         | jsonb                | Routing data (minimal) |
| read_at      | timestamptz          | When read              |
| push_sent_at | timestamptz          | When push was sent     |
| archived_at  | timestamptz          | When archived          |
| created_at   | timestamptz          | Creation time          |

**Note:** Clients cannot INSERT or DELETE notifications. Server-only creation.

### achievements

| Column           | Type                 | Description      |
| ---------------- | -------------------- | ---------------- |
| id               | uuid (PK)            | Achievement ID   |
| user_id          | uuid (FK → profiles) | User             |
| achievement_type | text                 | Achievement type |
| unlocked_at      | timestamptz          | When unlocked    |

**Constraint:** `UNIQUE(user_id, achievement_type)`

---

## Health Domain

### health_connections

| Column              | Type                 | Description               |
| ------------------- | -------------------- | ------------------------- |
| id                  | uuid (PK)            | Connection ID             |
| user_id             | uuid (FK → profiles) | User                      |
| provider            | text                 | 'healthkit' / 'googlefit' |
| connected_at        | timestamptz          | When connected            |
| last_sync_at        | timestamptz          | Last successful sync      |
| permissions_granted | text[]               | Granted permissions       |
| is_active           | boolean              | Currently connected       |
| disconnected_at     | timestamptz          | When disconnected         |

**Constraint:** `UNIQUE(user_id, provider)`

### health_sync_logs

| Column               | Type                 | Description                                        |
| -------------------- | -------------------- | -------------------------------------------------- |
| id                   | uuid (PK)            | Log ID                                             |
| user_id              | uuid (FK → profiles) | User                                               |
| provider             | text                 | Health provider                                    |
| sync_type            | text                 | 'background' / 'manual' / 'initial'                |
| started_at           | timestamptz          | Sync start                                         |
| completed_at         | timestamptz          | Sync end                                           |
| status               | text                 | 'in_progress' / 'completed' / 'failed' / 'partial' |
| records_processed    | integer              | Total records                                      |
| records_inserted     | integer              | New records                                        |
| records_deduplicated | integer              | Duplicates skipped                                 |
| error_message        | text                 | Error details                                      |
| metadata             | jsonb                | Additional data                                    |

---

## Migration History

| Migration | Description                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------- |
| 001       | Initial schema (profiles, challenges, participants, activity_logs, notifications, achievements) |
| 002       | profiles_public split with sync trigger                                                         |
| 003       | Friends hardening (directional model, bidirectional uniqueness)                                 |
| 004       | Activity idempotency (client_event_id, source_external_id)                                      |
| 005       | Push tokens table                                                                               |
| 006       | Consent and audit tables                                                                        |
| 007       | RLS policies                                                                                    |
| 008       | RLS helper functions (recursion prevention)                                                     |
| 009       | Challenge effective status function                                                             |
| 010       | Activity summary RPC                                                                            |
| 011       | Server time enforcement for activity logging                                                    |
| 012       | get_server_time RPC                                                                             |
| 013       | Custom activity name support                                                                    |
| 014       | create_challenge_atomic RPC                                                                     |
| 015       | invite_to_challenge RPC                                                                         |
| 016       | Notification read RPCs                                                                          |
| 017       | Server time challenge filters                                                                   |
| 018       | Challenge data RPC                                                                              |
| 019       | Leaderboard RPC                                                                                 |
| 020       | Drop deprecated RPCs                                                                            |
| 021       | Fix leaderboard ambiguous column                                                                |
| 022       | Add calories challenge type                                                                     |
| 023       | Health sync infrastructure                                                                      |
| 024       | log_health_activity RPC                                                                         |
| 025       | health_setup_completed_at tracking                                                              |
| 026       | Notifications created_at NOT NULL                                                               |
| 027       | respond_to_invite RPC                                                                           |
| 028       | Notification archive support                                                                    |
| 029       | Notification types complete                                                                     |

---

## Related Documents

- [RLS Policies](./rls-policies.md) — Row Level Security rules
- [RPC Functions](../api/rpc-functions.md) — Database functions
- [Architecture Overview](./overview.md) — System architecture
