# FitChallenge Documentation

Welcome to the FitChallenge developer documentation.

## Quick Links

### Getting Started

| Document                                       | Description                   |
| ---------------------------------------------- | ----------------------------- |
| [Getting Started](./guides/getting-started.md) | Development environment setup |
| [UI Migration Guide](./guides/ui-migration.md) | V1 to V2 UI migration         |
| [HealthKit Setup](./guides/healthkit-setup.md) | Health data integration       |
| [Deployment Guide](./guides/deployment.md)     | Production deployment         |

### Architecture

| Document                                                   | Description                  |
| ---------------------------------------------------------- | ---------------------------- |
| [Overview](./architecture/overview.md)                     | System design and principles |
| [Database Schema](./architecture/database-schema.md)       | Table definitions            |
| [RLS Policies](./architecture/rls-policies.md)             | Row Level Security rules     |
| [Feature Flags](./architecture/feature-flags.md)           | UI version switching         |
| [Health Integration](./architecture/health-integration.md) | HealthKit/Google Fit sync    |

### API Reference

| Document                                | Description              |
| --------------------------------------- | ------------------------ |
| [Services](./api/services.md)           | TypeScript service layer |
| [Hooks](./api/hooks.md)                 | React hooks reference    |
| [RPC Functions](./api/rpc-functions.md) | Database functions       |
| [Components](./api/components.md)       | UI component library     |

### Architecture Decisions

| Document                                                                 | Description                |
| ------------------------------------------------------------------------ | -------------------------- |
| [ADR-001: Parallel Routes](./decisions/ADR-001-parallel-routes.md)       | V1/V2 migration strategy   |
| [ADR-002: Health Abstraction](./decisions/ADR-002-health-abstraction.md) | Provider abstraction layer |
| [ADR-003: E2E Strategy](./decisions/ADR-003-e2e-strategy.md)             | Detox testing approach     |

### Other

| Document                     | Description              |
| ---------------------------- | ------------------------ |
| [Testing](./TESTING.md)      | Test infrastructure      |
| [Scope](./SCOPE.md)          | Project scope definition |
| [CHANGELOG](../CHANGELOG.md) | Version history          |

## Project Structure

```
FitChallenge/
├── app/                    # Expo Router screens
├── src/
│   ├── components/         # Reusable UI components
│   ├── hooks/              # React hooks
│   ├── lib/                # Core utilities (supabase, validation)
│   ├── services/           # Business logic services
│   │   ├── health/         # Health data integration
│   │   └── ...             # Challenge, friends, activity services
│   ├── stores/             # Zustand state management
│   └── types/              # TypeScript type definitions
├── supabase/
│   ├── migrations/         # Database migrations
│   └── functions/          # Edge functions
└── docs/                   # This documentation
```

## Key Commands

```bash
# Development
npm start                    # Start Expo development server
npm run ios                  # Run on iOS simulator
npm run android              # Run on Android emulator

# Testing
npm test                     # Run unit tests
npm run test:integration     # Run integration tests

# Database
npx supabase db push         # Apply migrations
npx supabase gen types       # Generate TypeScript types

# Building
eas build --platform ios     # Build iOS app
eas build --platform android # Build Android app
```

## Environment Variables

Create a `.env` file with:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
```

## Architecture Principles

1. **Database-First Security** — RLS policies are the source of truth
2. **Privacy by Default** — Separate public/private profile data
3. **Idempotent Operations** — All writes are safe to retry
4. **Offline-First** — React Query caching + offline queue
5. **Type Safety** — End-to-end TypeScript with Zod validation

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.
