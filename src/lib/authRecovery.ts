// src/lib/authRecovery.ts
// =============================================================================
// Global Expired-Session Recovery
// =============================================================================
// Idempotent handler for expired/missing auth sessions.
// Called from:
//   1. Module-level QueryClient error handlers (app/_layout.tsx)
//   2. AuthProvider auth state change events (AuthProvider.tsx)
//
// IMPORTANT: This module is context-free — no React context, no router.
// Navigation is driven by auth state through the protected-route flow.
// Sign-out propagates, and the existing auth shell redirects to sign-in.
// =============================================================================

import type { QueryClient } from "@tanstack/react-query";
import { authService } from "@/services/auth";
import { useSecurityStore } from "@/stores/securityStore";

// =============================================================================
// SESSION-MISSING DETECTION
// =============================================================================

/**
 * Detect whether an error indicates an expired or missing auth session.
 * Covers Supabase AuthSessionMissingError, JWT expiry, and PostgREST auth codes.
 */
export function isExpiredSessionError(error: unknown): boolean {
  if (!error) return false;

  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  // Supabase AuthSessionMissingError
  if (lowerMessage.includes("auth session missing")) return true;

  // JWT expired
  if (lowerMessage.includes("jwt expired")) return true;

  // Refresh token failures
  if (lowerMessage.includes("invalid refresh token")) return true;
  if (lowerMessage.includes("refresh_token_not_found")) return true;

  // PostgREST JWT error codes
  const err = error as Record<string, unknown> | null;
  const code = typeof err?.code === "string" ? err.code : "";
  if (code === "PGRST301" || code === "PGRST302") return true;

  return false;
}

// =============================================================================
// RECOVERY HANDLER
// =============================================================================

let isRecovering = false;

/**
 * Handle an expired session by clearing the query cache and signing out.
 * Idempotent — concurrent calls are coalesced into a single recovery.
 *
 * @param queryClient - The QueryClient instance to clear (in-memory cache).
 *   authService.signOut() handles the persisted cache (queryPersister.ts).
 *   Navigation is NOT performed here — the auth shell redirects on sign-out.
 */
export async function handleExpiredSession(queryClient: QueryClient): Promise<void> {
  // Idempotency guard: prevent concurrent recovery attempts
  if (isRecovering) return;
  isRecovering = true;

  try {
    console.warn("[AuthRecovery] Expired session detected — signing out");

    // 1. Clear in-memory React Query cache
    queryClient.clear();

    // 2. Reset security store (biometric preferences) — matches manual sign-out path
    useSecurityStore.getState().reset();

    // 3. Delegate to authService.signOut() which also clears persisted cache
    //    via clearPersistedQueryCache() in queryPersister.ts
    try {
      await authService.signOut();
    } catch (signOutError) {
      // Sign-out may itself fail if session is already gone — that's fine.
      // The cache is already cleared, and the auth shell will redirect.
      console.warn("[AuthRecovery] Sign-out error (expected if session already gone):", signOutError);
    }
  } finally {
    isRecovering = false;
  }
}
