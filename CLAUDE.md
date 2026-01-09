# CLAUDE.md - FitChallenge Coding Guide

## Purpose

You are helping implement FitChallenge. This repo prioritizes correctness, privacy, and database-authoritative security.

## Absolute Rules (Read First)

You MUST follow `CLAUDE_SYSTEM_RULES.md`.  
If a request conflicts with it: STOP and explain the conflict.

## Working Style

- Prefer small, reviewable changes.
- Do not add new features outside the requested scope.
- Favor contract-aligned implementation over convenience.

## Required Workflow (Do This Every Time)

1. Identify the exact user story / task.
2. Identify impacted contracts (privacy, RLS visibility, idempotency, notifications).
3. Implement changes through the service layer or RPC (never direct UI writes).
4. Ensure queries use `profiles_public` for other-user identity (never `profiles`).
5. Ensure activity logging uses `log_activity` with a client_event_id.
6. Handle database-denied states as normal UI states (do not add UI-side auth rules).
7. Add/adjust minimal tests or validation where applicable.

## Output Expectations

When you propose code:

- Include what files change and why.
- Keep code snippets minimal and focused.
- Prefer patch/diff format if possible.
- Call out any assumptions explicitly.

## Forbidden Without Explicit Permission

- Changing database schema (tables/columns/indexes/RLS).
- Introducing new tables, new enums, or â€œhelperâ€ schema.
- Implementing client-created notifications.
- Joining `profiles` for other users.
- Implementing multi-step activity writes (insert + update).
- Referencing deprecated documentation.

## Pre-Response Self-Check (Must Pass)

Before you answer, verify:

- I did not join or query `profiles` for non-self identity.
- I did not implement UI-side authorization logic.
- All activity logging uses `log_activity` and is idempotent.
- I did not propose schema changes.
- I did not create/delete notifications from the client.
  If any check fails: STOP and correct.
