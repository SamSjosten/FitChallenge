# FitChallenge Documentation

Welcome to the FitChallenge developer documentation.

## Quick Links

| Document                                                   | Description                      |
| ---------------------------------------------------------- | -------------------------------- |
| [Getting Started](./guides/getting-started.md)             | Development environment setup    |
| [Architecture Overview](./architecture/overview.md)        | System design and principles     |
| [Health Integration](./architecture/health-integration.md) | HealthKit/Google Fit sync        |
| [Service API Reference](./api/services.md)                 | TypeScript service documentation |

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
