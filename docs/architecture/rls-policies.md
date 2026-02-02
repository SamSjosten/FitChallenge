# Row Level Security Policies

> **Last Updated:** February 2025  
> **Source:** Migration 007 (`20240101000007_rls_policies.sql`)

This document describes the Row Level Security (RLS) policies that enforce data access control in FitChallenge.

## Design Principles

1. **Database is the security boundary** — Authorization is enforced by RLS, not application code
2. **Deny by default** — Tables with RLS enabled reject all access unless a policy allows it
3. **Least privilege** — Users can only access data required for their role
4. **No UI-side enforcement** — UI reflects database-denied states but doesn't implement access rules

## Quick Reference

| Table                  | SELECT                 | INSERT      | UPDATE    | DELETE       |
| ---------------------- | ---------------------- | ----------- | --------- | ------------ |
| profiles               | Self only              | Trigger     | Self only | Cascade      |
| profiles_public        | All auth               | None        | Trigger   | Cascade      |
| challenges             | Creator + Participants | Creator     | Creator   | Creator      |
| challenge_participants | Role-based             | Creator     | Self      | None         |
| activity_logs          | Self only              | Via RPC     | None      | None         |
| friends                | Both parties           | Requester   | Recipient | Either party |
| notifications          | Self only              | Server only | Self      | None         |
| push_tokens            | Self only              | Self        | Self      | Self         |
| achievements           | Self only              | Server only | None      | None         |
| consent_records        | Self only              | Self        | None      | None         |
| audit_log              | Self only              | Server only | None      | None         |
| health_connections     | Self only              | Via RPC     | Via RPC   | Via RPC      |
| health_sync_logs       | Self only              | Via RPC     | Via RPC   | None         |

---

## Helper Functions

Challenge and participant tables have circular references in their RLS policies. To prevent PostgreSQL infinite recursion errors, helper functions with `SECURITY DEFINER` are used.

```sql
-- Check if user is a participant with given status(es)
CREATE FUNCTION check_participant_status(
  p_challenge_id uuid,
  p_user_id uuid,
  p_statuses text[]
) RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;

-- Check if user is the challenge creator
CREATE FUNCTION is_challenge_creator(
  p_challenge_id uuid,
  p_user_id uuid
) RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;

-- Check if user is any participant (pending or accepted)
CREATE FUNCTION is_challenge_participant(
  p_challenge_id uuid,
  p_user_id uuid
) RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;
```

**Source:** Migration 008 (`20240101000008_rls_helper_functions.sql`)

---

## User Domain

### profiles

**Private user data — self-only access.**

```sql
-- SELECT: Only own profile
CREATE POLICY "Users can view their own full profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- UPDATE: Only own profile
CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- INSERT: Via trigger only (on auth.users insert)
-- DELETE: Via cascade from auth.users
```

### profiles_public

**Public identity — global read, no client write.**

```sql
-- SELECT: All authenticated users
CREATE POLICY "Public profiles are viewable by everyone"
ON profiles_public FOR SELECT
USING (true);

-- No INSERT/UPDATE/DELETE policies
-- Writes happen via trigger from profiles table
```

### push_tokens

```sql
-- ALL: Self-only management
CREATE POLICY "Users can manage their push tokens"
ON push_tokens FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

### consent_records

```sql
-- SELECT: Own records
CREATE POLICY "Users can view their own consent records"
ON consent_records FOR SELECT
USING (user_id = auth.uid());

-- INSERT: Own records
CREATE POLICY "Users can insert their own consent records"
ON consent_records FOR INSERT
WITH CHECK (user_id = auth.uid());

-- No UPDATE/DELETE (immutable audit trail)
```

### audit_log

```sql
-- SELECT: Own records
CREATE POLICY "Users can view their own audit log"
ON audit_log FOR SELECT
USING (user_id = auth.uid());

-- No client INSERT/UPDATE/DELETE
-- Server creates audit entries via service role
```

---

## Challenge Domain

### challenges

```sql
-- SELECT: Creator or any participant
CREATE POLICY "Users can view challenges they are part of"
ON challenges FOR SELECT
USING (
  creator_id = auth.uid()
  OR is_challenge_participant(challenges.id, auth.uid())
);

-- INSERT: Anyone (becomes creator)
CREATE POLICY "Users can create challenges"
ON challenges FOR INSERT
WITH CHECK (creator_id = auth.uid());

-- UPDATE: Creator only
CREATE POLICY "Creators can update their challenges"
ON challenges FOR UPDATE
USING (creator_id = auth.uid())
WITH CHECK (creator_id = auth.uid());
```

### challenge_participants

**Role-based visibility:**

- Users always see their own row
- Creators see all participants
- Accepted participants see other accepted participants
- Pending invitees see only themselves

```sql
-- SELECT: Role-based
CREATE POLICY "Participants visibility scoped by role"
ON challenge_participants FOR SELECT
USING (
  -- Users always see their own row
  user_id = auth.uid()
  -- Creator sees all participants
  OR is_challenge_creator(challenge_id, auth.uid())
  -- Accepted participants see other accepted participants
  OR (
    invite_status = 'accepted'
    AND check_participant_status(challenge_id, auth.uid(), ARRAY['accepted'])
  )
);

-- INSERT: Creator only
CREATE POLICY "Creators can invite participants"
ON challenge_participants FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM challenges c
    WHERE c.id = challenge_id AND c.creator_id = auth.uid()
  )
);

-- UPDATE: Self only (for invite response)
CREATE POLICY "Users can respond to their own invitations"
ON challenge_participants FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- No DELETE policy
```

### activity_logs

```sql
-- SELECT: Own logs only
CREATE POLICY "Users can view their own activity"
ON activity_logs FOR SELECT
USING (user_id = auth.uid());

-- INSERT: Own logs only
CREATE POLICY "Users can insert their own activity"
ON activity_logs FOR INSERT
WITH CHECK (user_id = auth.uid());

-- No UPDATE/DELETE (append-only, immutable)
```

**Note:** Activity logging should use the `log_activity` RPC for atomic insert + aggregation.

---

## Social Domain

### friends

**Directional model with recipient-only acceptance.**

```sql
-- SELECT: Both parties
CREATE POLICY "Friends viewable by participants"
ON friends FOR SELECT
USING (
  auth.uid() = requested_by
  OR auth.uid() = requested_to
);

-- INSERT: Requester only, must be pending
CREATE POLICY "Users can send friend requests"
ON friends FOR INSERT
WITH CHECK (
  auth.uid() = requested_by
  AND status = 'pending'
);

-- UPDATE: Recipient only (accept/decline/block)
CREATE POLICY "Recipients can respond to requests"
ON friends FOR UPDATE
USING (auth.uid() = requested_to)
WITH CHECK (auth.uid() = requested_to);

-- DELETE: Either party (unfriend)
CREATE POLICY "Participants can delete friendships"
ON friends FOR DELETE
USING (
  auth.uid() = requested_by
  OR auth.uid() = requested_to
);
```

**Key invariant:** Requesters cannot accept their own requests. Only recipients can UPDATE.

### notifications

```sql
-- SELECT: Own notifications
CREATE POLICY "Users can read their notifications"
ON notifications FOR SELECT
USING (auth.uid() = user_id);

-- UPDATE: Own notifications (mark read/archive)
CREATE POLICY "Users can mark notifications read"
ON notifications FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- No INSERT/DELETE policies
-- Notifications are created by server (RPCs or Edge Functions)
```

### achievements

```sql
-- SELECT: Own achievements
CREATE POLICY "Users can view their own achievements"
ON achievements FOR SELECT
USING (user_id = auth.uid());

-- No client INSERT/UPDATE/DELETE
-- Achievements are granted by server-side logic
```

---

## Health Domain

### health_connections

```sql
-- SELECT: Own connections
CREATE POLICY "Users can view their health connections"
ON health_connections FOR SELECT
USING (user_id = auth.uid());

-- INSERT/UPDATE/DELETE via RPCs:
-- - connect_health_provider
-- - disconnect_health_provider
```

### health_sync_logs

```sql
-- SELECT: Own sync logs
CREATE POLICY "Users can view their health sync logs"
ON health_sync_logs FOR SELECT
USING (user_id = auth.uid());

-- INSERT/UPDATE via RPCs:
-- - start_health_sync
-- - complete_health_sync
```

---

## Testing RLS Policies

### Unit Tests

Test each policy by:

1. Authenticating as different users
2. Attempting operations that should succeed
3. Attempting operations that should fail

```typescript
// Example: Test friend request acceptance
it("should prevent requester from accepting their own request", async () => {
  const requester = await createTestUser();
  const recipient = await createTestUser();

  // Create request as requester
  await supabaseAs(requester).from("friends").insert({
    requested_by: requester.id,
    requested_to: recipient.id,
    status: "pending",
  });

  // Try to accept as requester (should fail)
  const { error } = await supabaseAs(requester)
    .from("friends")
    .update({ status: "accepted" })
    .eq("requested_by", requester.id);

  expect(error).toBeTruthy();
});
```

### Common Pitfalls

1. **Forgetting RLS is enabled** — New tables have RLS but no policies by default
2. **Service role bypasses RLS** — Never use service role from client
3. **Circular policy references** — Use helper functions to prevent recursion
4. **Joins leak data** — RLS applies to each table in a join independently

---

## Related Documents

- [Database Schema](./database-schema.md) — Table definitions
- [Architecture Overview](./overview.md) — Security model overview
- [CLAUDE_SYSTEM_RULES.md](../../CLAUDE_SYSTEM_RULES.md) — Engineering rules
