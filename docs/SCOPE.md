# FitChallenge — Scope & Status

This document defines the **actual scope** of the FitChallenge repository.
It exists to prevent scope creep, clarify intent, and distinguish between
validated features and experimental work.

If there is a conflict between this document and implementation details,
**this document wins**.

---

## V1 — Validated Vertical Slice

The following features are considered **implemented, intentional, and stable**.
They define the core FitChallenge loop.

### Core Flow

- Sign up / sign in
- Automatic profile creation
- Create challenge
- Invite participant
- Accept invite
- Log activity
- View leaderboard

### Challenge Window Semantics

- Challenge activity window is **time-derived**, not status-driven
- Active window uses a **half-open interval**:  
  `[start_date, end_date)`
- Status is derived from time via `challenge_effective_status`
- No cron jobs or scheduled "status flips"

### Activity Logging

- All activity logging goes through the `log_activity` RPC
- Logging is allowed **only** when the challenge is active
- Logging is **idempotent**
  - Manual logs require `client_event_id`
  - Health/provider logs require `source_external_id`
- Duplicate submissions succeed silently without double-counting
- Progress counters are updated atomically after successful insert

### Privacy & Security

- `profiles` is self-only
- `profiles_public` is used for other-user identity
- RLS is authoritative for visibility and permissions
- Pending invitees cannot view leaderboards
- UI reflects database-denied states; it does not enforce authorization

### Health Data Integration (Phase 1 Complete)

- Connect Apple Health (iOS) or Google Fit (Android)
- Health settings screen at `/settings/health`
- Manual sync with deduplication
- Batch activity import with challenge attribution
- Sync history and stats display

**Implementation:**

- `health_connections` table tracks active connections
- `health_sync_logs` table audits all sync operations
- `log_health_activity` RPC handles batch insert with SHA-256 deduplication
- Provider abstraction: HealthKitProvider (iOS), MockHealthProvider (testing)
- React hooks: `useHealthConnection`, `useHealthSync`, `useHealthData`

---

## Implemented but NOT V1 (Experimental)

The following features **exist in the codebase**, but are not considered
complete, stable, or committed. They may change or be removed.

These features should:

- not be expanded unless explicitly requested
- not be relied on as "supported"
- not be documented as finalized behavior

### Friends System UI

**Status:** UI exists, backend hardened, not validated end-to-end

- `app/(tabs)/friends.tsx` provides a friends tab with search and list
- Backend uses directional model (`requested_by`/`requested_to`)
- Only recipient can accept requests (RLS enforced)
- Service layer: `src/services/friends.ts`
- Hooks: `src/hooks/useFriends.ts`

**Why experimental:** The flow works but hasn't been validated as part of the
core vertical slice. Friend invites to challenges are validated; standalone
friend management is not.

### Notifications Inbox UI

**Status:** UI exists, in-app notifications work, push delivery not guaranteed

- `app/notifications.tsx` displays notification inbox
- Notifications are created server-side via `enqueue_*` functions
- `push_sent_at` column prevents duplicate push delivery
- Service layer: `src/services/notifications.ts`

**Why experimental:** In-app notifications display correctly. Push notification
delivery requires Edge Function deployment and Expo push credentials, which
are environment-dependent and not part of the validated slice.

### Completed Challenges UI

**Status:** Query exists, UI partially implemented

- `challengeService.getCompletedChallenges()` returns historical challenges
- Challenges tab can display completed challenges
- Status derived from `end_date <= now()`

**Why experimental:** Display works but historical challenge features (stats,
rankings, replay) are not implemented.

### Scheduled Challenge Start UI

**Status:** Works via derived status, no dedicated UI polish

- Challenges with `start_date` in the future show as "upcoming"
- `getEffectiveStatus()` handles this automatically
- No countdown timer or "starting soon" notifications

**Why experimental:** The mechanics work but the UX is minimal.

### Realtime Subscriptions

**Status:** Implemented, not validated under load

- `src/hooks/useRealtimeSubscription.ts` subscribes to table changes
- `useLeaderboardSubscription()` updates leaderboard on activity
- React Query cache invalidation on realtime events

**Why experimental:** Works in development but not load-tested. Subscription
cleanup and reconnection handling may need hardening.

---

## Planned (Next, Explicitly Deferred)

These features are planned but **not implemented** yet.

- ~~Health data import (manual sync first, automation later)~~ ✅ Phase 1 complete
- Background health sync automation
- Push notification delivery (Expo Push API)
- Challenge start/end notifications
- Challenge window polish (editing rules, countdowns)
- Apple Sign-In (requires Apple Developer account configuration)
- Data export / account deletion UI (GDPR compliance)

---

## Implementation Notes (Reference)

These are key implementation patterns used throughout the codebase. They are
stable but documented here rather than README to keep README focused on the
user-facing vertical slice.

### Server Time Synchronization

- `get_server_time()` RPC returns server `now()`
- Client library: `src/lib/serverTime.ts`
- Offset cached locally: `serverTime - deviceTime`
- Auto-sync on auth events; 5-minute resync interval
- `getServerNow()` returns device time + cached offset

**Why it matters:** Challenge status and activity windows depend on consistent
time. Client-server clock drift could cause "challenge not active" errors.

### Derived Challenge Status

- `challenge_effective_status(challenge_id)` derives status from timestamps
- Half-open interval: `[start_date, end_date)`
- Override statuses (`cancelled`, `archived`) take precedence
- Client mirror: `src/lib/challengeStatus.ts`

**Why it matters:** No scheduled jobs required. Status is always consistent.

### Atomic Challenge Creation

- `create_challenge_with_participant()` RPC creates challenge + creator
  participation in single transaction
- Prevents partial state where challenge exists without creator

### Activity Logging Signature

Current `log_activity` signature (migration 011):

```
log_activity(
  p_challenge_id uuid,
  p_activity_type text,
  p_value integer,
  p_source text,              -- Required
  p_client_event_id uuid,     -- Optional (required for manual)
  p_source_external_id text,  -- Optional (for health sync)
  p_recorded_at timestamptz   -- Optional (ignored for manual source)
)
```

- Manual logs always use server `now()` regardless of `p_recorded_at`
- Only trusted sources (`healthkit`, `googlefit`) can provide timestamps

### Health Sync Deduplication

- SHA-256 hash generated from immutable sample properties
- Hash stored in `source_external_id` column
- Unique constraint prevents duplicate imports
- Batch processing: 100 activities per RPC call

---

## Non-Goals (For Now)

The following are explicitly out of scope:

- Public challenges or discovery
- Global feeds or social timelines
- Cron-based challenge state mutation
- Client-authored notifications
- Background automation without idempotent guarantees

---

## Documentation Rules

- README documents the **validated vertical slice only**
- Experimental features must live here, not in README
- `CLAUDE.md` defines coding rules, not feature catalogs
