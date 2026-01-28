# Getting Started

This guide will help you set up the FitChallenge development environment.

## Prerequisites

- **Node.js 18+** (LTS recommended)
- **npm** or **yarn**
- **VS Code** with recommended extensions
- **Expo Go** app on your phone (or iOS Simulator / Android Emulator)
- **Supabase account** (free tier works)
- **Apple Developer account** ($99/year, required for TestFlight)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/FitChallenge.git
cd FitChallenge
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx  # Optional for dev
```

### 4. Database Setup

Initialize the Supabase database:

```bash
# Login to Supabase CLI
npx supabase login

# Link to your project
npx supabase link --project-ref your-project-ref

# Apply all migrations
npx supabase db push

# Generate TypeScript types
npx supabase gen types typescript --linked > src/types/database.ts
```

### 5. Start Development Server

```bash
npm start
```

This opens Expo DevTools. Scan the QR code with Expo Go (iOS/Android) or press:

- `i` for iOS Simulator
- `a` for Android Emulator

## Project Structure

```
FitChallenge/
├── app/                    # Expo Router screens
│   ├── (auth)/             # Authentication screens
│   ├── (tabs)/             # Main tab screens
│   ├── challenge/          # Challenge detail screens
│   └── settings/           # Settings screens
├── src/
│   ├── components/         # Reusable UI components
│   ├── hooks/              # React hooks
│   ├── lib/                # Core utilities
│   │   ├── supabase.ts     # Supabase client
│   │   ├── queryClient.ts  # React Query setup
│   │   └── validation.ts   # Zod schemas
│   ├── services/           # Business logic
│   │   ├── challenges.ts   # Challenge operations
│   │   ├── friends.ts      # Friend operations
│   │   ├── activities.ts   # Activity logging
│   │   └── health/         # Health data integration
│   ├── stores/             # Zustand stores
│   └── types/              # TypeScript definitions
├── supabase/
│   ├── migrations/         # SQL migrations
│   └── functions/          # Edge functions
└── docs/                   # Documentation
```

## VS Code Setup

### Recommended Extensions

- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Expo Tools
- Tailwind CSS IntelliSense (if using NativeWind)

### Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## Common Commands

### Development

```bash
npm start                    # Start Expo dev server
npm run ios                  # Run on iOS simulator
npm run android              # Run on Android emulator
npm run web                  # Run in browser (limited)
```

### Testing

```bash
npm test                     # Run Jest tests
npm run test:watch           # Watch mode
npm run test:coverage        # Coverage report
npm run test:integration     # Integration tests
```

### Database

```bash
npx supabase db push         # Apply migrations to remote
npx supabase db reset        # Reset local database
npx supabase gen types typescript --linked > src/types/database.ts
```

### Building

```bash
eas build --platform ios --profile development
eas build --platform android --profile development
eas build --platform ios --profile preview
eas submit --platform ios
```

## Troubleshooting

### "Unable to resolve module" errors

```bash
# Clear Metro cache
npm start -- --clear

# Or full reset
rm -rf node_modules
rm package-lock.json
npm install
```

### Supabase connection issues

1. Verify `.env` variables are correct
2. Check that your IP is allowed in Supabase dashboard
3. Ensure migrations have been applied

### iOS Simulator issues

```bash
# Reset simulator
xcrun simctl shutdown all
xcrun simctl erase all
```

### TypeScript errors after schema changes

```bash
# Regenerate types
npx supabase gen types typescript --linked > src/types/database.ts
```

## Next Steps

- Read the [Architecture Overview](./architecture/overview.md)
- Review the [Service API Reference](./api/services.md)
- Check out the [Health Integration Guide](./architecture/health-integration.md)
