# Architecture Overview

FitChallenge is a React Native fitness challenge app built with Expo, TypeScript, and Supabase.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Mobile App                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Screens   │  │   Hooks     │  │   Stores    │              │
│  │  (Expo      │  │  (React     │  │  (Zustand)  │              │
│  │   Router)   │  │   Query)    │  │             │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          │                                      │
│                   ┌──────▼──────┐                               │
│                   │  Services   │                               │
│                   │ (Business   │                               │
│                   │   Logic)    │                               │
│                   └──────┬──────┘                               │
│                          │                                      │
│         ┌────────────────┼────────────────┐                     │
│         │                │                │                     │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐              │
│  │  Supabase   │  │  HealthKit  │  │  AsyncStorage│             │
│  │   Client    │  │  /Google Fit│  │  (Offline)   │             │
│  └──────┬──────┘  └─────────────┘  └──────────────┘             │
└─────────┼───────────────────────────────────────────────────────┘
          │
          │ HTTPS (REST + Realtime)
          │
┌─────────▼───────────────────────────────────────────────────────┐
│                        Supabase                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  PostgreSQL │  │    Auth     │  │   Storage   │              │
│  │  + RLS      │  │  (JWT)      │  │  (Avatars)  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐  ┌─────────────┐                               │
│  │  Realtime   │  │    Edge     │                               │
│  │  (WebSocket)│  │  Functions  │                               │
│  └─────────────┘  └─────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

## Layer Responsibilities

### Screens (app/)

- UI rendering and user interaction
- Route navigation (Expo Router)
- Compose hooks and components
- **No direct database access**

### Hooks (src/hooks/)

- React Query for server state
- Zustand for client state
- Encapsulate data fetching logic
- Provide loading/error states

### Services (src/services/)

- Business logic implementation
- Database operations via Supabase
- Input validation (Zod schemas)
- Error handling and transformation

### Supabase (supabase/)

- PostgreSQL with Row Level Security
- Authentication (email, Apple Sign-In)
- Realtime subscriptions
- Edge Functions for server-side logic

## Data Flow

### Read Flow

```
Screen → useQuery Hook → Service → Supabase RPC/Query → RLS Check → Data
```

### Write Flow

```
Screen → useMutation Hook → Service → Validation → Supabase RPC → RLS Check → Commit
```

### Offline Flow

```
Screen → Service → Offline Queue (Zustand) → [Later] → Supabase
```

## Security Model

All data access is controlled by PostgreSQL Row Level Security (RLS).

| Table                  | SELECT                 | INSERT      | UPDATE                 | DELETE       |
| ---------------------- | ---------------------- | ----------- | ---------------------- | ------------ |
| profiles               | Self only              | Trigger     | Self only              | Cascade      |
| profiles_public        | All auth               | None        | Trigger                | Cascade      |
| challenges             | Creator + Participants | Creator     | Creator                | Creator      |
| challenge_participants | Role-based             | Creator     | Self (invite response) | None         |
| activity_logs          | Self only              | Via RPC     | None                   | None         |
| friends                | Both parties           | Requester   | Recipient              | Either party |
| notifications          | Self only              | Server only | Self (mark read)       | None         |

## Technology Stack

| Layer          | Technology            | Purpose                  |
| -------------- | --------------------- | ------------------------ |
| UI Framework   | React Native          | Cross-platform mobile    |
| Navigation     | Expo Router           | File-based routing       |
| Language       | TypeScript            | Type safety              |
| Backend        | Supabase              | Database, Auth, Realtime |
| State          | React Query + Zustand | Server + Client state    |
| Validation     | Zod                   | Runtime type checking    |
| Health Data    | react-native-health   | HealthKit integration    |
| Error Tracking | Sentry                | Production monitoring    |
