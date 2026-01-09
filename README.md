# FitChallenge - Vertical Slice Implementation

A working end-to-end implementation of the FitChallenge app proving the core flow:
**Sign up → Create challenge → Invite friend → Accept invite → Log activity → View leaderboard**

> This README documents the validated vertical slice.
> For exact feature scope and experimental work, see `docs/SCOPE.md`.

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

---

## File Structure

```
app/
├── _layout.tsx          # Root layout with auth routing
├── index.tsx            # Root redirect
├── (auth)/
│   ├── login.tsx        # Sign in
│   └── signup.tsx       # Sign up
├── (tabs)/
│   ├── _layout.tsx      # Tab navigation
│   ├── index.tsx        # Home/Dashboard
│   └── profile.tsx      # Profile screen
└── challenge/
    ├── create.tsx       # Create challenge
    └── [id].tsx         # Challenge detail + leaderboard

src/
├── components/ui.tsx    # Reusable UI components
├── constants/config.ts  # Environment config
├── hooks/
│   ├── useAuth.ts       # Auth state management
│   └── useChallenges.ts # Challenge data hooks
├── lib/
│   ├── supabase.ts      # Supabase client
│   └── validation.ts    # Zod schemas
├── services/
│   ├── auth.ts          # Auth operations
│   ├── activities.ts    # Activity logging (RPC)
│   └── challenges.ts    # Challenge CRUD
└── types/database.ts    # TypeScript types

supabase/migrations/     # Database migrations (001-007)
```

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
