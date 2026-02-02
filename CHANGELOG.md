# Changelog

All notable changes to FitChallenge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Health service unit tests
- Documentation scaffolding for architecture, API, and guides

---

## [2.0.0] - In Development

Major UI redesign with parallel routing architecture, HealthKit integration, and production hardening.

### Added

#### UI System

- **Parallel route architecture** — V1 (`app/(tabs)/`) and V2 (`app/(tabs-v2)/`) coexist
- **Feature flag system** — Runtime UI version switching via `useFeatureFlags()`
- **Emerald theme** — New color palette (`#10B981` primary, replacing Electric Mint)
- **V2 shared components** — EmptyState, LoadingState, ErrorState, StreakBanner, ChallengeCard, etc.
- **V2 tab screens** — Home, Challenges, Friends, Profile with refreshed design
- **V2 auth screens** — Combined login/signup, onboarding, welcome

#### HealthKit Integration

- **Health provider abstraction** — `IHealthProvider` interface for HealthKit/Google Fit
- **HealthKitProvider** — iOS health data integration
- **MockHealthProvider** — Testing provider with configurable behavior
- **Health service orchestrator** — Sync management, batch processing, deduplication
- **Health settings screen** — Connection management, sync history, permissions
- **Database infrastructure** — `health_connections`, `health_sync_logs` tables
- **`log_health_activity` RPC** — Batch activity insertion with SHA-256 deduplication

#### Database Migrations

- Migration 022: Add `calories` challenge type enum value
- Migration 023: Health sync infrastructure tables
- Migration 024: `log_health_activity` RPC with batch processing
- Migration 025: `health_setup_completed_at` profile tracking
- Migration 026-029: Notification system improvements

#### Testing Infrastructure

- **Detox E2E framework** — Configured for iOS simulator
- **E2E test suites** — Auth, challenges, friends, health, offline, profile
- **GitHub Actions workflow** — Automated E2E testing on CI

### Changed

- **Challenge status** — Now computed from time boundaries (`get_challenge_effective_status`)
- **Activity logging** — Server-authoritative timestamps via `log_activity` RPC
- **Notification system** — Type-safe notification payloads, archive support

### Security

- **RLS helper functions** — Prevent infinite recursion in challenge visibility policies
- **Server time enforcement** — Activity logging uses server timestamps, not client

### Deprecated

- V1 UI routes (will be removed after stable V2 rollout)

### Migration Guide

To switch to V2 UI:

1. Update to this version
2. In Settings, enable "New UI" toggle, or
3. Change `DEFAULT_UI_VERSION` in `src/lib/featureFlags.ts` to `"v2"`

---

## [1.0.0] - 2024-XX-XX

Initial release.

### Added

- Challenge creation and participation
- Activity logging (manual)
- Friends system with directional requests
- Leaderboards
- Notifications (in-app)
- User profiles with privacy split (`profiles` / `profiles_public`)
- Offline queue for activity logging
- Biometric authentication (Face ID / Touch ID)

### Security

- Row Level Security (RLS) on all tables
- Profile privacy split — public identity separate from private data
- Friends model hardening — recipient-only acceptance
- Activity idempotency — `client_event_id` prevents double-counting

---

[Unreleased]: https://github.com/your-org/fitchallenge/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/your-org/fitchallenge/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/your-org/fitchallenge/releases/tag/v1.0.0
