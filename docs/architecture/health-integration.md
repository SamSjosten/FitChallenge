# Health Integration Architecture

FitChallenge integrates with HealthKit (iOS) and Google Fit (Android) to automatically sync fitness data.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Health Service                              │
│                                                                 │
│  ┌─────────────────┐      ┌─────────────────┐                   │
│  │  HealthKit      │      │  Google Fit     │                   │
│  │  Provider       │      │  Provider       │                   │
│  │  (iOS)          │      │  (Android)      │                   │
│  └────────┬────────┘      └────────┬────────┘                   │
│           │                        │                            │
│           └──────────┬─────────────┘                            │
│                      │                                          │
│              ┌───────▼───────┐                                  │
│              │  Data Mapper  │                                  │
│              │  + Hash Gen   │                                  │
│              └───────┬───────┘                                  │
│                      │                                          │
│              ┌───────▼───────┐                                  │
│              │  Challenge    │                                  │
│              │  Attribution  │                                  │
│              └───────┬───────┘                                  │
│                      │                                          │
│              ┌───────▼───────┐                                  │
│              │  Batch Insert │                                  │
│              │  (RPC)        │                                  │
│              └───────────────┘                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Sync Flow

1. **Trigger**: User initiates sync or background task fires
2. **Start Log**: Create `health_sync_logs` entry with status "in_progress"
3. **Fetch Samples**: Query native health API for date range
4. **Transform**: Convert native samples to `ProcessedActivity` format
5. **Generate Hashes**: Create SHA-256 hash for each sample (deduplication)
6. **Attribute Challenges**: Match activities to active challenges by type and date
7. **Batch Insert**: Call `log_health_activity` RPC with activity array
8. **Complete Log**: Update sync log with results (inserted/deduplicated counts)

## Deduplication Strategy

Health data is deduplicated using a SHA-256 hash of immutable sample properties:

```typescript
const hashInput = [
  sample.type, // Activity type (steps, calories, etc.)
  sample.value, // Numeric value
  sample.unit, // Unit of measurement
  sample.startDate, // ISO timestamp
  sample.endDate, // ISO timestamp
  sample.sourceId, // Source app bundle ID
  sample.id, // Native sample ID
].join("|");

const hash = SHA256(hashInput);
```

The hash is stored in `activity_logs.source_external_id` with a unique constraint:

```sql
CREATE UNIQUE INDEX activity_logs_source_dedupe
ON public.activity_logs (user_id, source, source_external_id)
WHERE source_external_id IS NOT NULL;
```

## Database Schema

### health_connections

Tracks user connections to health providers.

| Column              | Type        | Description                       |
| ------------------- | ----------- | --------------------------------- |
| id                  | uuid        | Primary key                       |
| user_id             | uuid        | FK to profiles                    |
| provider            | text        | 'healthkit' or 'googlefit'        |
| connected_at        | timestamptz | When connection was established   |
| last_sync_at        | timestamptz | Last successful sync time         |
| permissions_granted | jsonb       | Array of granted permission types |
| is_active           | boolean     | Whether connection is active      |

### health_sync_logs

Audit trail for sync operations.

| Column               | Type        | Description                                     |
| -------------------- | ----------- | ----------------------------------------------- |
| id                   | uuid        | Primary key                                     |
| user_id              | uuid        | FK to profiles                                  |
| provider             | text        | 'healthkit' or 'googlefit'                      |
| sync_type            | text        | 'background', 'manual', 'initial'               |
| started_at           | timestamptz | When sync started                               |
| completed_at         | timestamptz | When sync completed                             |
| status               | text        | 'in_progress', 'completed', 'failed', 'partial' |
| records_processed    | integer     | Total samples processed                         |
| records_inserted     | integer     | New records inserted                            |
| records_deduplicated | integer     | Duplicates skipped                              |
| error_message        | text        | Error details if failed                         |

## Provider Interface

All health providers implement `IHealthProvider`:

```typescript
interface IHealthProvider {
  readonly provider: HealthProvider;

  isAvailable(): Promise<boolean>;
  getAuthorizationStatus(): Promise<PermissionResult>;
  requestAuthorization(
    permissions: HealthPermission[],
  ): Promise<PermissionResult>;
  fetchSamples(
    startDate: Date,
    endDate: Date,
    types: ChallengeType[],
  ): Promise<HealthSample[]>;

  // Optional
  subscribeToUpdates?(
    types: ChallengeType[],
    callback: (samples: HealthSample[]) => void,
  ): () => void;
  enableBackgroundDelivery?(types: ChallengeType[]): Promise<boolean>;
}
```

## Activity Type Mapping

### HealthKit → ChallengeType

| HealthKit Type                                 | Challenge Type |
| ---------------------------------------------- | -------------- |
| HKQuantityTypeIdentifierStepCount              | steps          |
| HKQuantityTypeIdentifierAppleExerciseTime      | active_minutes |
| HKQuantityTypeIdentifierActiveEnergyBurned     | calories       |
| HKQuantityTypeIdentifierDistanceWalkingRunning | distance       |
| HKQuantityTypeIdentifierDistanceCycling        | distance       |

### Google Fit → ChallengeType

| Google Fit Type              | Challenge Type |
| ---------------------------- | -------------- |
| com.google.step_count.delta  | steps          |
| com.google.active_minutes    | active_minutes |
| com.google.calories.expended | calories       |
| com.google.distance.delta    | distance       |

## React Hooks

### useHealthConnection

```typescript
const {
  status, // 'connected' | 'disconnected' | 'syncing' | 'error'
  connection, // HealthConnection object or null
  lastSync, // Date of last sync or null
  isLoading,
  isConnecting,
  connect, // (permissions?) => Promise<void>
  disconnect, // () => Promise<void>
} = useHealthConnection();
```

### useHealthSync

```typescript
const {
  sync, // (options?) => Promise<SyncResult>
  isSyncing,
  lastResult, // SyncResult or null
  syncHistory, // HealthSyncLog[]
} = useHealthSync();
```

### useHealthData

```typescript
const {
  activities, // ProcessedActivity[]
  isLoading,
  hasNextPage,
  fetchNextPage,
} = useHealthData({ pageSize: 50, activityType: "steps" });
```

## Sync Types

| Type       | Lookback | Trigger                |
| ---------- | -------- | ---------------------- |
| background | 3 days   | Background fetch task  |
| manual     | 7 days   | User-initiated refresh |
| initial    | 30 days  | First connection       |

## Privacy Considerations

- Health data requires explicit user permission
- Data is stored only in user's own account (RLS enforced)
- No health data is shared with other users
- Users can disconnect and delete synced data

## Error Handling

Common errors and handling:

| Error               | Cause                   | Handling                     |
| ------------------- | ----------------------- | ---------------------------- |
| `not_available`     | HealthKit not on device | Show "not available" message |
| `permission_denied` | User denied access      | Prompt to grant in Settings  |
| `network_error`     | No connection           | Queue for retry              |
| `rate_limited`      | Too many requests       | Exponential backoff          |

## Testing

Use `MockHealthProvider` for testing:

```typescript
import {
  createMockHealthService,
  createFullyGrantedMockProvider,
} from "@/services/health";

const mockProvider = createFullyGrantedMockProvider();
const service = createMockHealthService(mockProvider);

// Configure mock behavior
mockProvider.setConfig({
  samples: [...mockSamples],
  fetchFails: false,
});

const result = await service.sync({ syncType: "manual" });
```
