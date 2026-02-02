# HealthKit Integration Guide

> **Last Updated:** February 2025  
> **Platform:** iOS only (Android Google Fit support planned)

This guide covers setting up and using HealthKit integration in FitChallenge.

## Overview

FitChallenge integrates with Apple HealthKit to automatically sync fitness data:

- Steps
- Active minutes
- Calories burned
- Distance
- Workouts

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Health Service                           │
│  ┌─────────────────┐                                            │
│  │  healthService  │ ◄── Orchestrator                           │
│  └────────┬────────┘                                            │
│           │                                                     │
│  ┌────────▼────────┐    ┌─────────────────┐                     │
│  │ HealthKitProvider│    │ MockHealthProvider│                  │
│  │   (iOS)         │    │   (Testing)       │                   │
│  └────────┬────────┘    └─────────────────┘                     │
│           │                                                     │
│  ┌────────▼────────┐                                            │
│  │  react-native-  │                                            │
│  │  health         │                                            │
│  └────────┬────────┘                                            │
└───────────┼─────────────────────────────────────────────────────┘
            │
            ▼
     Apple HealthKit
```

See [Health Integration Architecture](../architecture/health-integration.md) for details.

---

## iOS Setup

### 1. Configure Xcode Project

Add HealthKit capability in Xcode:

1. Open `ios/FitChallenge.xcworkspace`
2. Select the project target
3. Go to "Signing & Capabilities"
4. Click "+ Capability"
5. Add "HealthKit"

### 2. Add Usage Descriptions

Add to `ios/FitChallenge/Info.plist`:

```xml
<key>NSHealthShareUsageDescription</key>
<string>FitChallenge needs access to your health data to track your fitness progress and sync with challenges.</string>

<key>NSHealthUpdateUsageDescription</key>
<string>FitChallenge needs to save workout data to Health.</string>
```

### 3. Install Native Module

```bash
cd ios && pod install && cd ..
```

### 4. Configure app.json

Ensure HealthKit entitlement is included:

```json
{
  "expo": {
    "ios": {
      "entitlements": {
        "com.apple.developer.healthkit": true,
        "com.apple.developer.healthkit.access": []
      }
    }
  }
}
```

---

## App Store Requirements

### Privacy Disclosure

When submitting to the App Store, you must disclose health data usage:

1. In App Store Connect, go to "App Privacy"
2. Under "Health & Fitness", declare:
   - **Data types collected:** Health, Fitness
   - **Purpose:** App Functionality
   - **Linked to user:** Yes (for challenge tracking)
   - **Tracking:** No

### Review Guidelines

Apple reviews HealthKit apps more carefully. Ensure:

- Clear explanation of why health data is needed
- Health data is only used for stated purposes
- Users can disconnect health data at any time
- Data handling complies with privacy laws

---

## User Flow

### Connecting HealthKit

1. User navigates to Settings > Health
2. Taps "Connect Apple Health"
3. iOS permission dialog appears
4. User selects permissions to grant
5. App saves connection and performs initial sync

```typescript
// Triggered when user taps "Connect"
const { connect } = useHealthConnection();

try {
  await connect(["steps", "activeMinutes", "calories"]);
  // Connection saved, initial sync triggered
} catch (error) {
  // Handle permission denied or unavailable
}
```

### Sync Process

Sync happens:

- **Initial:** 30-day lookback when first connected
- **Manual:** User-triggered, 7-day lookback
- **Background:** Automatic, 3-day lookback (when implemented)

```typescript
const { sync, isSyncing } = useHealthSync();

// Manual sync
const result = await sync({
  syncType: "manual",
  lookbackDays: 7,
});

console.log(`Synced: ${result.recordsInserted} new records`);
```

### Disconnecting

User can disconnect at any time:

```typescript
const { disconnect } = useHealthConnection();
await disconnect();
// Connection record updated, no more syncs
```

---

## Database Schema

### health_connections

Tracks provider connections per user:

```sql
CREATE TABLE health_connections (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  provider text,  -- 'healthkit' | 'googlefit'
  connected_at timestamptz,
  last_sync_at timestamptz,
  permissions_granted text[],
  is_active boolean,
  disconnected_at timestamptz
);
```

### health_sync_logs

Audit trail of sync operations:

```sql
CREATE TABLE health_sync_logs (
  id uuid PRIMARY KEY,
  user_id uuid,
  provider text,
  sync_type text,  -- 'background' | 'manual' | 'initial'
  started_at timestamptz,
  completed_at timestamptz,
  status text,  -- 'in_progress' | 'completed' | 'failed' | 'partial'
  records_processed integer,
  records_inserted integer,
  records_deduplicated integer,
  error_message text
);
```

### activity_logs (health entries)

Health activities use the existing `activity_logs` table with:

- `source = 'healthkit'`
- `source_external_id` = SHA-256 hash for deduplication

---

## Deduplication

Health data can be synced multiple times (manual sync, background sync, device restore). Deduplication prevents double-counting.

### How It Works

1. Each health sample generates a unique hash:

   ```
   SHA-256(userId + sampleId + type + value + startDate + endDate)
   ```

2. Hash is stored in `source_external_id`

3. Database has unique constraint:

   ```sql
   UNIQUE(user_id, source, source_external_id)
   WHERE source_external_id IS NOT NULL
   ```

4. Duplicate inserts are silently ignored

### Implementation

```typescript
// src/services/health/utils/hashGenerator.ts
export function generateActivityHash(
  userId: string,
  sample: HealthSample,
): string {
  const data = `${userId}:${sample.id}:${sample.type}:${sample.value}:${sample.startDate}:${sample.endDate}`;
  return sha256(data);
}
```

---

## Challenge Attribution

Health activities can be automatically attributed to active challenges:

1. During sync, fetch user's active challenges:

   ```typescript
   const challenges = await supabase.rpc("get_challenges_for_health_sync");
   ```

2. For each activity, find matching challenge:

   ```typescript
   function findMatchingChallenge(activity, challenges) {
     return challenges.find(
       (c) =>
         c.challenge_type === activity.activity_type &&
         activity.recorded_at >= c.start_date &&
         activity.recorded_at <= c.end_date,
     );
   }
   ```

3. If match found, `challenge_id` is set on the activity

4. Challenge progress is updated atomically by `log_health_activity` RPC

---

## Error Handling

### Permission Denied

```typescript
if (error.message.includes("No health permissions")) {
  // Show explanation and link to Settings
  Alert.alert(
    "Health Access Required",
    "Please enable health access in Settings to sync your fitness data.",
    [{ text: "Open Settings", onPress: openSettings }, { text: "Cancel" }],
  );
}
```

### HealthKit Unavailable

```typescript
const isAvailable = await provider.isAvailable();
if (!isAvailable) {
  // Device doesn't support HealthKit (iPad, simulator)
  // Hide health features or show message
}
```

### Sync Failures

Sync failures are logged to `health_sync_logs` with error details:

```typescript
const { data: history } = await supabase
  .from("health_sync_logs")
  .select("*")
  .eq("status", "failed")
  .order("started_at", { ascending: false })
  .limit(5);

// Show recent failures to user for debugging
```

---

## Testing

### Simulator

HealthKit data can be added in the iOS Simulator:

1. Open Health app in simulator
2. Browse > Add Data
3. Enter sample values

### Unit Tests

Use `MockHealthProvider` for testing:

```typescript
import { MockHealthProvider, createMockProviderWithSamples } from '@/services/health/providers';

const mockSamples = [
  { id: '1', type: 'steps', value: 5000, ... },
  { id: '2', type: 'steps', value: 3000, ... },
];

const provider = createMockProviderWithSamples(mockSamples);
const service = new HealthService(provider);

const result = await service.sync({ syncType: 'manual' });
expect(result.recordsProcessed).toBe(2);
```

### E2E Tests

See `e2e/tests/health.e2e.ts` for integration tests.

---

## Troubleshooting

### "HealthKit is not available"

- Check device supports HealthKit (not iPad)
- Verify HealthKit capability is added in Xcode
- Ensure app is signed with proper provisioning profile

### "No permissions granted"

- User may have denied all permissions
- Guide user to Settings > Privacy > Health > FitChallenge
- Check specific permissions needed for challenge types

### "Sync completes but no data"

- Verify date range has data in Health app
- Check activity types match (`steps` vs `HKQuantityTypeIdentifierStepCount`)
- Ensure deduplication isn't filtering everything (check `records_deduplicated`)

### "Duplicate entries appearing"

- Verify `source_external_id` is being set
- Check unique constraint exists in database
- Ensure hash generation is deterministic

---

## Future: Google Fit

Google Fit integration is planned but not implemented. The provider interface is designed to support it:

```typescript
// src/services/health/providers/GoogleFitProvider.ts
export class GoogleFitProvider extends HealthProvider {
  readonly provider: HealthProvider = "googlefit";

  // TODO: Implement using react-native-google-fit
}
```

---

## Related Documents

- [Health Integration Architecture](../architecture/health-integration.md)
- [Database Schema](../architecture/database-schema.md#health-domain)
- [RPC Functions](../api/rpc-functions.md#health-functions)
