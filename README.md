# FitChallenge

A working end-to-end implementation of the FitChallenge app proving the core flow:
**Sign up → Create challenge → Invite friend → Accept invite → Log activity → View leaderboard**

> This README documents the validated vertical slice and the Electric Mint design system.
> For exact feature scope and experimental work, see `docs/SCOPE.md`.

---

## Quick Start

### 1. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the migrations in order:
   ```
   supabase/migrations/001_initial_schema.sql
   supabase/migrations/002_profiles_public.sql
   supabase/migrations/003_friends_hardening.sql
   supabase/migrations/004_activity_idempotency.sql
   supabase/migrations/005_push_tokens.sql
   supabase/migrations/006_consent_audit.sql
   supabase/migrations/007_rls_policies.sql
   supabase/migrations/008_rls_helper_functions.sql
   supabase/migrations/009_effective_status.sql
   supabase/migrations/010_activity_summary_rpc.sql
   supabase/migrations/011_enforce_server_time_activity_logging.sql
   supabase/migrations/012_get_server_time.sql
   ```
3. Copy your project URL and anon key from Settings → API

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Install & Run

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go (iOS/Android) or press `w` for web.

### 4. Run Tests

```bash
npm test              # Unit tests only
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests (requires .env.test)
npm run test:all      # All tests
```

#### Integration Tests Setup

Integration tests run against a real Supabase instance. Before running them:

```bash
cp .env.test.example .env.test
# Edit .env.test with your Supabase credentials
```

Required variables (from Supabase Dashboard → Settings → API):

- `SUPABASE_URL` - Your project URL
- `SUPABASE_ANON_KEY` - Public anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for test cleanup)

⚠️ **Never commit `.env.test`** - the service role key bypasses RLS.

---

## Design System

FitChallenge uses the **Electric Mint** design system with a cohesive theme built on Plus Jakarta Sans typography and Heroicons.

### Theme Prerequisites

1. The theme file (`src/constants/theme.ts`) contains color definitions
2. The ThemeProvider (`src/providers/ThemeProvider.tsx`) provides theme context
3. Plus Jakarta Sans fonts are loaded via `@expo-google-fonts/plus-jakarta-sans`

### Required Imports

Each screen uses these key imports:

```tsx
// Theme hook
import { useAppTheme } from "@/providers/ThemeProvider";

// Heroicons (outline variants)
import {
  HomeIcon,
  TrophyIcon,
  UsersIcon,
  UserIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  XMarkIcon,
  Cog6ToothIcon,
  BellIcon,
  UserPlusIcon,
} from "react-native-heroicons/outline";

// Heroicons (solid variants for active states)
import {
  HomeIcon as HomeIconSolid,
  TrophyIcon as TrophyIconSolid,
  UsersIcon as UsersIconSolid,
  UserIcon as UserIconSolid,
} from "react-native-heroicons/solid";

// For gradient headers
import { LinearGradient } from "expo-linear-gradient";
```

### Theme Usage Pattern

All screens follow this pattern:

```tsx
export default function Screen() {
  const { colors, spacing, radius, typography, shadows } = useAppTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Use inline styles with theme tokens */}
      <Text
        style={{
          fontSize: typography.fontSize.lg,
          fontFamily: "PlusJakartaSans_700Bold",
          color: colors.textPrimary,
        }}
      >
        Title
      </Text>
    </View>
  );
}
```

### Color Reference

| Old iOS Color | New Theme Color                 |
| ------------- | ------------------------------- |
| `#007AFF`     | `colors.primary.main` (#00D26A) |
| `#F2F2F7`     | `colors.background`             |
| `#34C759`     | `colors.success`                |
| `#FF9500`     | `colors.energy.main`            |
| `#FF3B30`     | `colors.error`                  |
| `#000000`     | `colors.textPrimary`            |
| `#666666`     | `colors.textSecondary`          |
| `#999999`     | `colors.textMuted`              |
| `#FFFFFF`     | `colors.surface`                |
| `#E5E5EA`     | `colors.border`                 |

---

## Testing the Happy Path

### Test 1: Auth + Profile Setup

1. Open app → see Login screen
2. Tap "Sign Up" → create account with:
   - Username: `testuser1`
   - Email: `test1@example.com`
   - Password: `Test1234`
3. After signup → redirected to Home
4. Tap Profile tab → see your profile data (username, XP, streaks)

### Test 2: Challenge Creation

1. On Home, tap "+ New" button
2. Fill in:
   - Title: "10K Steps Challenge"
   - Type: Steps
   - Goal: 10000
   - Duration: 7 days
3. Tap "Create Challenge"
   > Note: Challenge status is derived from start/end time; there is no stored "active" flag.
4. See new challenge on Home screen

### Test 3: Invite + Accept (requires 2 accounts)

**As User 1 (creator):**

1. Tap the challenge you created
2. Tap "+ Invite" button
3. Search for another user (e.g., `testuser2`)
4. Tap "Invite"

**As User 2 (invitee):**

1. Sign out User 1, sign in as User 2
2. See pending invite on Home screen
3. Tap "Accept"
4. Challenge now appears in Active Challenges

**Verify visibility:**

- Before accepting: User 2 sees "🔒 Accept the challenge to view the leaderboard"
- After accepting: User 2 sees full leaderboard

### Test 4: Log Activity

1. Open a challenge where you're an accepted participant
2. Tap "Log Activity" button
3. Enter a value (e.g., 5000 steps)
4. Tap "Log"
5. See your progress update immediately
6. See your position on leaderboard update

### Test 5: Leaderboard

1. Open challenge detail
2. Verify leaderboard shows:
   - Only accepted participants
   - Sorted by progress (highest first)
   - Your entry highlighted
   - Ranks (🥇🥈🥉 for top 3)

---

## Architecture Verification

### ✅ Privacy: profiles vs profiles_public

- Profile tab reads from `profiles` (self-only via RLS)
- Leaderboard reads from `profiles_public` (global read)

### ✅ RLS Enforcement

- Pending invitees can't see leaderboard (policy blocks it)
- Users can only log activity to challenges they've accepted

### ✅ Idempotent Activity Logging

- Each log call generates a unique `client_event_id`
- Duplicate submissions (retry) are safely ignored
- Progress counter updated atomically with log insertion

### ✅ Directional Friends (prepared for future)

- Schema supports `requested_by` / `requested_to`
- Only recipient can accept (not implemented in UI yet)

### ✅ Server Time Enforcement

- Activity logging uses server time via `get_server_time()` RPC
- Prevents client-side time manipulation

---

## File Structure

```
app/
├── _layout.tsx              # Root layout with auth routing
├── index.tsx                # Root redirect
├── notifications.tsx        # Notifications screen
├── friends.tsx              # Friends screen (⚠️ duplicate, see note)
├── (auth)/
│   ├── login.tsx            # Sign in
│   └── signup.tsx           # Sign up
├── (tabs)/
│   ├── _layout.tsx          # Tab navigation
│   ├── index.tsx            # Home/Dashboard
│   ├── challenges.tsx       # Challenges list
│   ├── create.tsx           # Create challenge (⚠️ duplicate, see note)
│   ├── friends.tsx          # Friends tab
│   └── profile.tsx          # Profile screen
└── challenge/
    ├── create.tsx           # Create challenge form
    └── [id].tsx             # Challenge detail + leaderboard

src/
├── components/
│   └── ui.tsx               # Reusable UI components
├── constants/
│   ├── config.ts            # Environment config
│   └── theme.ts             # Electric Mint theme tokens
├── providers/
│   └── ThemeProvider.tsx    # Theme context provider
├── hooks/
│   ├── useAuth.ts           # Auth state management
│   ├── useChallenges.ts     # Challenge data hooks
│   ├── useFriends.ts        # Friends data hooks
│   ├── useNotifications.ts  # Notifications hooks
│   └── useRealtimeSubscription.ts  # Supabase realtime
├── lib/
│   ├── supabase.ts          # Supabase client
│   ├── validation.ts        # Zod schemas
│   ├── challengeStatus.ts   # Challenge status utilities
│   ├── serverTime.ts        # Server time synchronization
│   ├── username.ts          # Username normalization
│   ├── uuid.ts              # UUID generation
│   └── __tests__/           # Unit tests for lib modules
│       ├── challengeStatus.test.ts
│       ├── generateClientEventId.test.ts
│       ├── serverTime.test.ts
│       ├── usernameNormalization.test.ts
│       └── withAuth.test.ts
├── services/
│   ├── auth.ts              # Auth operations
│   ├── activities.ts        # Activity logging (RPC)
│   ├── challenges.ts        # Challenge CRUD
│   ├── friends.ts           # Friends operations
│   └── notifications.ts     # Notifications service
├── types/
│   ├── database.ts          # TypeScript types
│   └── react-native-heroicons.d.ts  # Heroicons type defs
└── __tests__/
    ├── integration/
    │   ├── setup.ts
    │   ├── activities.integration.test.ts
    │   ├── activity.server-time.integration.test.ts
    │   ├── challenges.integration.test.ts
    │   └── friends.integration.test.ts
    └── unit/
        └── challenges.test.ts

supabase/
└── migrations/              # Database migrations (001-012)

docs/
└── SCOPE.md                 # Feature scope documentation
```

> ⚠️ **Note on duplicate files:**
>
> - `app/friends.tsx` and `app/(tabs)/friends.tsx` both exist
> - `app/(tabs)/create.tsx` and `app/challenge/create.tsx` both exist
>
> This duplication is noted for future cleanup.

### Design System Files

The Electric Mint design system is applied to these screens:

| Screen           | Location                    |
| ---------------- | --------------------------- |
| Tab Layout       | `app/(tabs)/_layout.tsx`    |
| Friends          | `app/(tabs)/friends.tsx`    |
| Profile          | `app/(tabs)/profile.tsx`    |
| Challenges       | `app/(tabs)/challenges.tsx` |
| Challenge Detail | `app/challenge/[id].tsx`    |
| Create Challenge | `app/challenge/create.tsx`  |
| Login            | `app/(auth)/login.tsx`      |
| Signup           | `app/(auth)/signup.tsx`     |
| Notifications    | `app/notifications.tsx`     |

---

## Validated Features (Vertical Slice)

| Feature                | Status | Notes                           |
| ---------------------- | ------ | ------------------------------- |
| Sign up / Sign in      | ✅     | Email/password auth             |
| Profile auto-creation  | ✅     | DB trigger on auth.users insert |
| Profile display        | ✅     | Self-only via RLS               |
| Create challenge       | ✅     | Creator auto-added as accepted  |
| Invite user            | ✅     | Search + invite modal           |
| Accept/decline invite  | ✅     | From Home screen                |
| Log activity (RPC)     | ✅     | Idempotent with client_event_id |
| Leaderboard            | ✅     | Reads from aggregated counters  |
| Visibility enforcement | ✅     | Pending can't see leaderboard   |

## Not Implemented or Not Yet Supported

- Apple Sign-In (requires Apple Developer account)
- Push notifications (requires setup)
- Offline queue (infrastructure only)
- Friends system UI (experimental / partial)
- Notifications inbox UI (experimental; no delivery guarantees)
- Health sync (HealthKit/Google Fit)
- Data export / account deletion UI

---

## Testing Checklists

### Functional Testing

- [ ] Auth flow works (signup, login, logout)
- [ ] Profile displays correctly
- [ ] Challenge creation works
- [ ] Invite flow works between two users
- [ ] Activity logging updates progress
- [ ] Leaderboard displays and ranks correctly
- [ ] Pending invitees cannot see leaderboard

### Design System Testing

After applying theme files:

- [ ] Tab bar shows Electric Mint active color
- [ ] Tab bar icons are Heroicons (not emojis)
- [ ] FAB button is Electric Mint with shadow
- [ ] Friends screen has search bar with icon
- [ ] Friends screen shows online indicators (green dot)
- [ ] Profile screen has stats grid and achievements
- [ ] Challenge detail has gradient header
- [ ] Create challenge has activity type grid
- [ ] Login/signup use theme colors
- [ ] Notifications use primary color for unread

---

## Troubleshooting

### "Profile not found" after signup

The DB trigger should auto-create the profile. Check:

1. Migration 001 ran successfully
2. The `handle_new_user` trigger exists
3. No errors in Supabase logs

### Can't see other users in search

Check RLS on `profiles_public`:

```sql
-- Should exist:
select * from public.profiles_public;  -- Should return all users
```

### Activity not logging

Check the `log_activity` function exists:

```sql
select proname from pg_proc where proname = 'log_activity';
```

### Leaderboard empty after accepting

Check RLS on `challenge_participants`:

```sql
-- As the user, should see accepted participants:
select * from public.challenge_participants
where challenge_id = 'your-challenge-id';
```

### Theme not applying

1. Verify `ThemeProvider` wraps your app in `_layout.tsx`
2. Check that `useAppTheme` hook is imported from the correct path
3. Ensure Plus Jakarta Sans fonts are loaded before rendering
