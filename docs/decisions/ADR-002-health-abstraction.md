# ADR-002: Health Provider Abstraction Layer

**Status:** Accepted  
**Date:** January 2025  
**Decision Makers:** Sam, Claudette

## Context

FitChallenge needs to integrate with health data sources:

- Apple HealthKit (iOS)
- Google Fit (Android, future)
- Possibly other providers (Fitbit, Garmin, etc.)

Each provider has different APIs, data formats, and authorization flows.

### Requirements

1. Support HealthKit now, Google Fit later
2. Share sync logic between providers
3. Enable mocking for tests without native modules
4. Handle deduplication across sync sessions
5. Batch processing for large data sets

## Decision

**Create a provider abstraction layer** with:

1. `IHealthProvider` interface — contract all providers implement
2. `HealthKitProvider` — iOS implementation
3. `MockHealthProvider` — testing implementation
4. `HealthService` — orchestrator that coordinates providers

## Rationale

### Why Not Direct HealthKit Integration?

- **Testing:** Can't run HealthKit in Jest
- **Future-proofing:** Adding Google Fit would require significant refactoring
- **Separation of concerns:** Provider details shouldn't leak into UI/services

### Why Provider Pattern?

- **Dependency injection:** Pass mock provider in tests
- **Single abstraction:** Same API regardless of iOS/Android
- **Isolated complexity:** Platform-specific code contained in one file

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        HealthService                             │
│                       (Orchestrator)                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  - Connect/disconnect flows                              │    │
│  │  - Sync orchestration                                    │    │
│  │  - Batch processing                                      │    │
│  │  - Database operations                                   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ uses
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      IHealthProvider                             │
│                        (Interface)                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  isAvailable(): Promise<boolean>                         │    │
│  │  requestAuthorization(): Promise<PermissionResult>       │    │
│  │  fetchSamples(): Promise<HealthSample[]>                 │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
    │ HealthKit   │    │ GoogleFit   │    │   Mock      │
    │  Provider   │    │  Provider   │    │  Provider   │
    │   (iOS)     │    │ (Android)   │    │  (Tests)    │
    └─────────────┘    └─────────────┘    └─────────────┘
```

## Interface Definition

```typescript
interface IHealthProvider {
  readonly provider: "healthkit" | "googlefit";

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

  // Optional for providers that support it
  subscribeToUpdates?(
    types: ChallengeType[],
    callback: (samples: HealthSample[]) => void,
  ): () => void;
  enableBackgroundDelivery?(types: ChallengeType[]): Promise<boolean>;
}
```

## Consequences

### Positive

- **Testability:** Full unit test coverage with MockHealthProvider
- **Extensibility:** Add new providers without changing service layer
- **Consistency:** Same API surface regardless of platform
- **Maintainability:** Provider-specific bugs isolated to one file

### Negative

- **Abstraction overhead:** Extra layer between app and native SDK
- **Lowest common denominator:** Some provider features may not be exposed
- **Development cost:** Must implement interface for each provider

### Mitigation

- Keep interface minimal — only methods needed by app
- Allow optional methods for advanced features
- Document provider-specific behaviors

## MockHealthProvider

The mock provider enables:

1. **Unit tests** — No native modules required
2. **E2E tests** — Deterministic data
3. **Development** — Test sync without real health data
4. **Error simulation** — Test failure paths

```typescript
const mockProvider = new MockHealthProvider({
  isAvailable: true,
  samples: mockSamples,
  delay: 100, // Simulate network latency
});

const service = new HealthService(mockProvider);
const result = await service.sync();
```

## Deduplication Strategy

Health data can be synced multiple times. Deduplication prevents double-counting.

**Approach:** SHA-256 hash of sample attributes

```typescript
function generateHash(userId: string, sample: HealthSample): string {
  const data = `${userId}:${sample.id}:${sample.type}:${sample.value}:${sample.startDate}`;
  return sha256(data);
}
```

**Database enforcement:**

```sql
CREATE UNIQUE INDEX ON activity_logs (user_id, source, source_external_id)
WHERE source_external_id IS NOT NULL;
```

## Related

- [HealthKit Setup Guide](../guides/healthkit-setup.md)
- [Health Integration Architecture](../architecture/health-integration.md)
- [RPC Functions: Health](../api/rpc-functions.md#health-functions)
