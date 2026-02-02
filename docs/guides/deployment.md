# Deployment Guide

> **Last Updated:** February 2025  
> **Status:** Scaffold — fill in with production details

This guide covers deploying FitChallenge to production.

## Overview

FitChallenge deployment consists of:

1. **Database** — Supabase hosted PostgreSQL
2. **Mobile App** — iOS via App Store, Android via Play Store
3. **Edge Functions** — Supabase Edge Functions (optional)

---

## Environment Configuration

### Development

```bash
# .env.local
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_SENTRY_DSN=
```

### Staging

```bash
# .env.staging
EXPO_PUBLIC_SUPABASE_URL=https://xxx-staging.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
```

### Production

```bash
# .env.production
EXPO_PUBLIC_SUPABASE_URL=https://xxx-prod.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## Database Deployment

### Initial Setup

1. Create Supabase project at [supabase.com](https://supabase.com)

2. Link local project:

   ```bash
   npx supabase login
   npx supabase link --project-ref your-project-ref
   ```

3. Apply migrations:
   ```bash
   npx supabase db push
   ```

### Migration Strategy

**Always use migrations** — never modify production schema directly.

```bash
# Create new migration
npx supabase migration new my_migration_name

# Test locally
npx supabase db reset

# Deploy to production
npx supabase db push
```

### Rollback Procedure

<!-- TODO: Document rollback procedure -->

1. Identify failing migration
2. Create compensating migration
3. Apply and verify

---

## iOS Deployment

### Prerequisites

- Apple Developer Account ($99/year)
- App Store Connect access
- Distribution certificate
- Provisioning profile

### Build Process

1. Update version in `app.json`:

   ```json
   {
     "expo": {
       "version": "2.0.0",
       "ios": {
         "buildNumber": "1"
       }
     }
   }
   ```

2. Build with EAS:

   ```bash
   eas build --platform ios --profile production
   ```

3. Submit to App Store:
   ```bash
   eas submit --platform ios
   ```

### App Store Review

**Required for HealthKit apps:**

- Demo video showing health features
- Clear privacy policy
- Explanation of health data usage

**Common rejection reasons:**

- Missing HealthKit entitlement
- Inadequate usage descriptions
- Privacy policy doesn't mention health data

---

## Android Deployment

### Prerequisites

- Google Play Developer Account ($25 one-time)
- Play Console access
- Upload key

### Build Process

1. Update version in `app.json`:

   ```json
   {
     "expo": {
       "version": "2.0.0",
       "android": {
         "versionCode": 1
       }
     }
   }
   ```

2. Build with EAS:

   ```bash
   eas build --platform android --profile production
   ```

3. Submit to Play Store:
   ```bash
   eas submit --platform android
   ```

---

## CI/CD Pipeline

### GitHub Actions

Workflows in `.github/workflows/`:

| Workflow     | Trigger          | Purpose                    |
| ------------ | ---------------- | -------------------------- |
| `test.yml`   | PR, push to main | Run unit/integration tests |
| `e2e.yml`    | PR to main       | Run E2E tests              |
| `deploy.yml` | Tag push         | Build and submit to stores |

### EAS Build Configuration

```json
// eas.json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "staging": {
      "distribution": "internal",
      "env": {
        "APP_ENV": "staging"
      }
    },
    "production": {
      "distribution": "store",
      "env": {
        "APP_ENV": "production"
      }
    }
  }
}
```

---

## Monitoring

### Sentry

Error tracking configured in `src/lib/sentry.ts`:

```typescript
Sentry.init({
  dsn: Config.sentryDsn,
  enableAutoSessionTracking: true,
  environment: Config.environment,
});
```

**Key metrics to monitor:**

- Crash-free sessions
- Error rate by screen
- Performance (app start time, screen transitions)

### Supabase Dashboard

Monitor in Supabase dashboard:

- Database connections
- API request latency
- Auth events
- Edge Function invocations

---

## Rollout Strategy

### Feature Flag Rollout

For V2 UI migration:

1. **Alpha** (internal): Flip flag manually
2. **Beta** (TestFlight): Opt-in toggle in settings
3. **Gradual**: Change default, monitor metrics
4. **Full**: Remove V1 code

### Staged Rollout (App Stores)

iOS and Android support staged rollouts:

- Start with 10% of users
- Monitor crash rates and reviews
- Gradually increase to 100%

---

## Checklist

### Pre-Deployment

- [ ] All tests passing
- [ ] Version bumped in `app.json`
- [ ] CHANGELOG updated
- [ ] Database migrations applied to staging
- [ ] Staging tested manually
- [ ] Privacy policy updated (if needed)

### Deployment

- [ ] Create git tag for version
- [ ] Build submitted to stores
- [ ] Database migrations applied to production
- [ ] Sentry release created

### Post-Deployment

- [ ] Monitor Sentry for new errors
- [ ] Check App Store/Play Store reviews
- [ ] Verify critical user flows
- [ ] Update status page (if applicable)

---

## Troubleshooting

### Build Fails

```bash
# Clear EAS cache
eas build:configure
eas build --clear-cache
```

### Migration Fails

```bash
# Check migration status
npx supabase migration list

# Manual fix (last resort)
# Connect to production database and fix manually
# Then mark migration as applied
```

### App Crashes on Startup

1. Check Sentry for crash logs
2. Verify environment variables are set
3. Check Supabase connection
4. Review recent changes in git

---

## Related Documents

- [Getting Started](./getting-started.md) — Local development setup
- [Testing Guide](../TESTING.md) — Test infrastructure
- [Architecture Overview](../architecture/overview.md) — System design
