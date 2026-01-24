# Component-Integration Tests

## Purpose

This test tier fills the gap between pure component tests and full integration tests:

| Tier                      | Mock Boundary    | What's Real                    | Catches                  |
| ------------------------- | ---------------- | ------------------------------ | ------------------------ |
| Component                 | Hooks, services  | JSX rendering                  | UI regressions           |
| **Component-Integration** | **Network only** | **Providers, hooks, services** | **Hook↔Component bugs**  |
| Integration               | Nothing          | Supabase, DB                   | Schema drift, RLS issues |

## What's Mocked vs Real

### REAL (Integration tested)

- `AuthProvider`, `ThemeProvider`, `QueryClientProvider`
- `useAuth`, `useChallenges`, `usePendingInvites`, `useRespondToInvite`
- `challengeService`, `authService`
- React Query cache behavior
- Zod validation in services
- Data transformation (RPC → component)

### MOCKED (Network boundary)

- `@/lib/supabase` → `mockSupabaseClient` (chainable query builder)
- RN platform modules (safe-area-context, linear-gradient, heroicons)
- `expo-router` navigation
- Font loading, push notifications, server time

## File Structure
