You are coding for the FitChallenge application.

THE FOLLOWING RULES ARE AUTHORITATIVE AND MUST NEVER BE VIOLATED.
THEY OVERRIDE ALL OTHER INSTRUCTIONS, SUGGESTIONS, OR OPTIMIZATIONS.

If any request conflicts with these rules, STOP and explain the conflict.

──────────────────────────────────────────────────────────────
SECURITY & AUTHORITY
──────────────────────────────────────────────────────────────

1. The database (Postgres + Row Level Security) is the security boundary.

   - Authorization, privacy, and correctness must not be enforced in UI code.
   - UI code must assume RLS policies are authoritative.

2. UI code must not implement authorization or privacy rules.
   - UI may reflect database-denied states.
   - UI must not attempt to enforce permissions or visibility.

──────────────────────────────────────────────────────────────
PRIVACY & DATA ACCESS
──────────────────────────────────────────────────────────────

3. The `profiles` table is private and self-only.

   - Code must never query or join `profiles` for any user other than auth.uid().

4. The `profiles_public` table is the only allowed source of other-user identity.

   - All identity displays must use `profiles_public`.

5. `profiles_public` must be used for:
   - leaderboards
   - participant lists
   - friends UI
   - challenge creator identity

──────────────────────────────────────────────────────────────
CHALLENGES & VISIBILITY
──────────────────────────────────────────────────────────────

6. Challenge visibility is role-based and enforced by RLS.

   - Pending invitees must not see leaderboards.
   - Pending invitees must not see accepted participant lists.
   - Declined or removed users must not see challenge data.

7. Only accepted participants affect competition state.

   - Only accepted participants appear in leaderboards.
   - Pending participants must not affect aggregation.

8. Challenge status is database-authoritative.
   - Clients must not directly set challenges to `active`.
   - Status transitions must occur via scheduled or server-side logic.

──────────────────────────────────────────────────────────────
FRIENDS MODEL
──────────────────────────────────────────────────────────────

9. Friend requests are directional.

   - Each friendship has exactly one requester and one recipient.

10. Only the recipient may accept or decline a friend request.

    - The requester must never be able to update request status.

11. Duplicate or conflicting friendships must be prevented at the database level.
    - There must never be more than one friendship row per user pair.

──────────────────────────────────────────────────────────────
ACTIVITY LOGGING
──────────────────────────────────────────────────────────────

12. Activity logs are append-only and immutable.

    - Activity logs must never be edited or deleted.
    - Corrections must use compensating entries.

13. All activity logging must be idempotent.

    - Manual activity entries must include a client-generated UUID idempotency key.
    - Duplicate submissions must not affect aggregated progress.

14. Activity logging must be atomic.

    - Activity insertion and aggregation must occur in a single transaction.
    - Clients must never implement multi-step insert/update logic.

15. All activity logging must use the `log_activity` database function.
    - Clients must not insert directly into `activity_logs`.

──────────────────────────────────────────────────────────────
NOTIFICATIONS
──────────────────────────────────────────────────────────────

16. Notifications are server-created, immutable inbox events.

    - Clients must not insert notification records.
    - Clients must not delete notification records.

17. Notification payloads must not leak private data.

    - Payloads may contain only minimal routing identifiers.
    - Participant lists, private stats, or social graphs are forbidden.

18. Push notification delivery must be idempotent.
    - Duplicate push delivery must be prevented via stored delivery state.

──────────────────────────────────────────────────────────────
ACCOUNT LIFECYCLE
──────────────────────────────────────────────────────────────

19. Account deletion must remove personal data without corrupting shared state.
    - Shared challenges must be archived rather than broken.
    - Orphaned or inconsistent records must not be created.

──────────────────────────────────────────────────────────────
IMPLEMENTATION DISCIPLINE
──────────────────────────────────────────────────────────────

20. UI components must not perform direct database writes.

    - All writes must go through a service function or RPC.
    - If no service exists, one must be created first.

21. Database schema must not be created, modified, or extended unless explicitly instructed.

    - If a feature appears to require schema changes, STOP and ask.

22. Deprecated documentation must never be referenced or implemented.
    - Only the Unified Architecture and v2 guides are valid.

──────────────────────────────────────────────────────────────
FAILURE HANDLING
──────────────────────────────────────────────────────────────

23. If any requested implementation conflicts with these rules:
    - STOP.
    - Explain the conflict.
    - Do not proceed.
