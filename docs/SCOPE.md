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

---

## Implemented but NOT V1 (Experimental)

The following features **exist in the codebase**, but are not considered
complete, stable, or committed. They may change or be removed.

- Scheduled challenge start UI
- Completed challenges UI
- Friends system UI
- Notifications inbox UI
- Realtime / focus-based refresh behaviors

These features should:

- not be expanded unless explicitly requested
- not be relied on as "supported"
- not be documented as finalized behavior

---

## Planned (Next, Explicitly Deferred)

These features are planned but **not implemented** yet.

- Notification outbox + lifecycle processor
- Challenge start/end notifications
- Health data import (manual sync first, automation later)
- Challenge window polish (editing rules, countdowns)

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
