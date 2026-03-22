// src/providers/AuthProvider.tsx
// Centralized auth state provider - SINGLE source of truth for authentication
//
// =============================================================================
// ARCHITECTURE: Clean Ownership Model
// =============================================================================
//
// Two paths set auth state. Their responsibilities never overlap:
//
// 1. LISTENER (passive/external events only):
//    - INITIAL_SESSION → bootstrap on app launch (load profile)
//    - SIGNED_OUT      → clear all state
//    - TOKEN_REFRESHED → update session reference silently (no profile reload)
//    - USER_UPDATED    → update session/user when metadata changes
//    - Everything else → IGNORED (calling methods own those flows)
//
// 2. CALLING METHODS (own their full flow):
//    - signIn / signUp / signInWithApple / signInWithGoogle each:
//      (a) Call the auth service
//      (b) Fetch the resulting session
//      (c) Load the profile
//      (d) Set state
//
// Because the listener ignores SIGNED_IN, there is no
// coordination flag needed. No race conditions. No skip logic.
// =============================================================================

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { Session, User, AuthError } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "@/lib/supabase";
import { authService, configureGoogleSignIn } from "@/services/auth";
import { pushTokenService } from "@/services/pushTokens";
import { useSecurityStore } from "@/stores/securityStore";
import { syncServerTime, getServerNow, RESYNC_INTERVAL_MS } from "@/lib/serverTime";
import { resetHealthService } from "@/services/health";
import { addBreadcrumb } from "@/lib/sentry";
import type { Profile } from "@/types/database-helpers";

// =============================================================================
// ERRORS
// =============================================================================

/**
 * Structured error for auth timeout.
 * UI can check `error.code === 'AUTH_TIMEOUT'` or `error instanceof AuthTimeoutError`
 */
export class AuthTimeoutError extends Error {
  readonly code = "AUTH_TIMEOUT" as const;

  constructor(message = "Authentication timed out. Please check your connection and try again.") {
    super(message);
    this.name = "AuthTimeoutError";
  }
}

// =============================================================================
// TYPES
// =============================================================================

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean; // Auth/session loading
  profileError: Error | null; // Separate error state for profile failures
  isRefreshingProfile: boolean; // For retry UI
  error: AuthError | Error | null; // Auth-level errors (sign in failures, etc.)
  pendingEmailConfirmation: boolean;
}

interface AuthContextValue extends AuthState {
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
}

// =============================================================================
// CONTEXT
// =============================================================================

const AuthContext = createContext<AuthContextValue | null>(null);

// =============================================================================
// PROVIDER
// =============================================================================

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    loading: true,
    profileError: null,
    isRefreshingProfile: false,
    error: null,
    pendingEmailConfirmation: false,
  });

  const queryClient = useQueryClient();

  // Track mounted state for async operations
  const mountedRef = useRef(true);

  // Guard against concurrent profile loading
  const profileLoadingRef = useRef(false);

  // ==========================================================================
  // PROFILE LOADING HELPER
  // ==========================================================================

  /**
   * Load user profile and set authenticated state.
   *
   * IMPORTANT: Sets session immediately, then loads profile.
   * This ensures ProtectedRoute sees the session even if profile loading is slow.
   * Profile errors are stored separately so they don't block auth state.
   */
  const loadProfileAndSetState = useCallback(async (session: Session) => {
    // Guard against concurrent calls
    if (profileLoadingRef.current) {
      console.log(`[AuthProvider] ⏭️ loadProfileAndSetState skipped - already loading`);
      return;
    }
    profileLoadingRef.current = true;
    const startTime = Date.now();
    const shortId = session.user.id.substring(0, 8);
    console.log(`[AuthProvider] 📂 loadProfileAndSetState starting for ${shortId}`);

    // Set session IMMEDIATELY so ProtectedRoute knows user is authenticated
    setState((prev) => ({
      ...prev,
      session,
      user: session.user,
      loading: false,
      profileError: null,
    }));

    // Sync server time (non-blocking)
    syncServerTime().catch((err) => console.warn("Server time sync failed:", err));

    try {
      const profile = await authService.getMyProfileWithUserId(session.user.id);

      if (mountedRef.current) {
        const elapsed = Date.now() - startTime;
        console.log(`[AuthProvider] ✅ Profile loaded for ${shortId} in ${elapsed}ms`);
        setState((prev) => ({
          ...prev,
          profile,
          profileError: null,
          pendingEmailConfirmation: false,
        }));

        // Register push token if permission already granted (non-blocking)
        pushTokenService
          .registerToken()
          .catch((err) => console.warn("Push token registration failed:", err));
      } else {
        console.log(`[AuthProvider] ⚠️ Unmounted before setState (${Date.now() - startTime}ms)`);
      }
    } catch (err) {
      console.error(
        `[AuthProvider] ❌ Profile load failed for ${shortId} (${Date.now() - startTime}ms):`,
        err,
      );
      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          profile: null,
          profileError: err as Error,
        }));
      }
    } finally {
      profileLoadingRef.current = false;
    }
  }, []);

  // ==========================================================================
  // AUTH LISTENER (passive/external events ONLY)
  // ==========================================================================

  useEffect(() => {
    mountedRef.current = true;

    // Configure Google Sign-In SDK (no-op if env vars not set)
    configureGoogleSignIn();

    // Gate TOKEN_REFRESHED until bootstrap completes.
    // Before INITIAL_SESSION, Supabase's auth context may not be ready for RLS.
    let bootstrapComplete = false;

    const {
      data: { subscription },
    } = getSupabaseClient().auth.onAuthStateChange(async (event, session) => {
      console.log(
        `[AuthProvider] 📡 onAuthStateChange: event=${event}, session=${session ? "YES" : "NO"}, bootstrap=${bootstrapComplete}`,
      );

      if (!mountedRef.current) return;

      // =================================================================
      // INITIAL_SESSION: App launch/restore — the ONLY bootstrap path
      // =================================================================
      if (event === "INITIAL_SESSION") {
        bootstrapComplete = true;

        if (session?.user) {
          console.log(
            `[AuthProvider] 🎬 Bootstrap: loading profile for ${session.user.id.substring(0, 8)}`,
          );
          addBreadcrumb("auth_session_restored");
          await loadProfileAndSetState(session);
        } else {
          console.log(`[AuthProvider] 🎬 Bootstrap: no session`);
          addBreadcrumb("auth_no_session");
          setState((prev) => ({ ...prev, loading: false }));
        }
        return;
      }

      // =================================================================
      // SIGNED_OUT: Always process — clear all state
      // =================================================================
      if (event === "SIGNED_OUT" || !session) {
        console.log(`[AuthProvider] 🚪 Signed out (event=${event})`);
        addBreadcrumb("auth_signed_out");
        bootstrapComplete = true;
        resetHealthService();
        // Clear in-memory query cache on sign-out to prevent stale data
        queryClient.clear();
        setState({
          session: null,
          user: null,
          profile: null,
          loading: false,
          profileError: null,
          isRefreshingProfile: false,
          error: null,
          pendingEmailConfirmation: false,
        });
        return;
      }

      // =================================================================
      // TOKEN_REFRESHED: Update session silently (no profile reload)
      // =================================================================
      if (event === "TOKEN_REFRESHED") {
        if (!bootstrapComplete) {
          console.log(`[AuthProvider] ⏭️ Skipping TOKEN_REFRESHED before bootstrap`);
          return;
        }
        console.log(`[AuthProvider] 🔄 Token refreshed — updating session`);
        addBreadcrumb("auth_token_refreshed");
        setState((prev) => ({
          ...prev,
          session,
          user: session.user,
        }));
        return;
      }

      // =================================================================
      // USER_UPDATED: Update session/user when metadata changes.
      // updateUser() writes to the server and emits this event with the
      // updated session. Unlike SIGNED_IN (which calling methods handle
      // end-to-end with profile loading), USER_UPDATED just means
      // "user object changed" and carries no complex side effects.
      // Handling it here ensures any updateUser() call, anywhere in the
      // codebase, automatically propagates to React state.
      // =================================================================
      if (event === "USER_UPDATED") {
        if (!bootstrapComplete) {
          console.log(`[AuthProvider] ⏭️ Skipping USER_UPDATED before bootstrap`);
          return;
        }
        console.log(`[AuthProvider] 📝 User updated — updating session`);
        addBreadcrumb("auth_user_updated");
        setState((prev) => ({
          ...prev,
          session,
          user: session!.user,
        }));
        return;
      }

      // =================================================================
      // ALL OTHER EVENTS: Ignored.
      // SIGNED_IN is a side effect of sign-in methods that already
      // handle their full flow end-to-end.
      // =================================================================
      console.log(`[AuthProvider] ⏭️ Ignoring ${event} — caller owns this flow`);
    });

    // Safety timeout: if INITIAL_SESSION never fires (corrupted storage, etc.)
    const safetyTimeout = setTimeout(() => {
      if (mountedRef.current) {
        setState((prev) => {
          if (prev.loading) {
            console.warn("[AuthProvider] ⏱️ Auth init timed out — INITIAL_SESSION never fired");
            return {
              ...prev,
              loading: false,
              error: new AuthTimeoutError(),
            };
          }
          return prev;
        });
      }
    }, 10000);

    return () => {
      mountedRef.current = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, [loadProfileAndSetState]);

  // ==========================================================================
  // PERIODIC SERVER TIME SYNC
  // ==========================================================================

  useEffect(() => {
    if (!state.session) return;

    const intervalId = setInterval(() => {
      syncServerTime().catch((err) => console.warn("Periodic server time sync failed:", err));
    }, RESYNC_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [state.session]);

  // ==========================================================================
  // GOTRUE AUTO-REFRESH LIFECYCLE
  // ==========================================================================
  // GoTrue's autoRefreshToken is disabled at client creation (see supabase.ts)
  // to prevent a persistent setInterval from blocking Detox idle detection on
  // cold launch. Instead, we manually start/stop the refresh ticker based on
  // session existence. This is the officially recommended pattern for non-browser
  // platforms per GoTrue docs.

  useEffect(() => {
    const client = getSupabaseClient();

    if (state.session) {
      // Session exists — start the refresh ticker so tokens stay fresh.
      // startAutoRefresh() is idempotent (internally calls stop before start).
      client.auth.startAutoRefresh();
    } else {
      // No session — ensure ticker is stopped (no-op if already stopped).
      client.auth.stopAutoRefresh();
    }

    return () => {
      // Cleanup: stop ticker on unmount or before re-run
      client.auth.stopAutoRefresh();
    };
  }, [state.session]);

  // ==========================================================================
  // SOCIAL AUTH HELPER
  // ==========================================================================

  /**
   * Detect if a social auth session belongs to a brand-new user and ensure
   * onboarding_completed is set to false so useProtectedRoute redirects them.
   *
   * Social auth users don't go through signUp(), so the metadata flag isn't
   * set automatically. We detect "new" by checking:
   *   - onboarding_completed is undefined (never set)
   *   - created_at is within the last 2 minutes (just provisioned by Supabase)
   *
   * NOTE: Calling updateUser() triggers a USER_UPDATED event in the listener,
   * which updates React state with the new session. This is harmless here
   * because loadProfileAndSetState() runs afterward and sets the same
   * session plus the profile — the final state is identical either way.
   */
  const ensureNewUserOnboarding = useCallback(async (session: Session) => {
    const metadata = session.user.user_metadata;
    const shortId = session.user.id.substring(0, 8);

    if (metadata?.onboarding_completed !== undefined) {
      console.log(
        `[AuthProvider] 🔍 Onboarding flag already set (${metadata.onboarding_completed}) for ${shortId}`,
      );
      return session;
    }

    const createdAt = new Date(session.user.created_at).getTime();
    const ageMs = getServerNow().getTime() - createdAt;
    const isNew = ageMs < 2 * 60 * 1000;

    if (!isNew) {
      console.log(
        `[AuthProvider] 🔍 Existing social user ${shortId} (age=${Math.round(ageMs / 1000)}s)`,
      );
      return session;
    }

    console.log(
      `[AuthProvider] 🆕 New social user ${shortId} (age=${Math.round(ageMs / 1000)}s), setting onboarding flag`,
    );

    try {
      await authService.setOnboardingFlag(false);
    } catch (flagError) {
      console.warn(`[AuthProvider] Failed to set onboarding metadata:`, flagError);
      return session;
    }

    // Return refreshed session with updated metadata
    const {
      data: { session: refreshedSession },
    } = await getSupabaseClient().auth.getSession();
    return refreshedSession ?? session;
  }, []);

  // ==========================================================================
  // AUTH ACTIONS (each method owns its full flow)
  // ==========================================================================

  const signUp = useCallback(
    async (email: string, password: string, username: string) => {
      console.log(`[AuthProvider] 📝 signUp() called`);
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const { session: returnedSession } = await authService.signUp({
          email,
          password,
          username,
        });

        if (returnedSession) {
          // Auto-confirm enabled — verify and load
          const {
            data: { session },
            error: sessionError,
          } = await getSupabaseClient().auth.getSession();

          if (sessionError) {
            throw new Error(`Failed to verify session: ${sessionError.message}`);
          }
          if (!session) {
            throw new Error("Sign up succeeded but no session was created. Please try again.");
          }

          await loadProfileAndSetState(session);
          addBreadcrumb("auth_signup_complete", { method: "email" });
          console.log(`[AuthProvider] ✅ signUp() complete`);
        } else {
          // Email confirmation required
          console.log(`[AuthProvider] 📧 signUp() complete — pending email confirmation`);
          setState((prev) => ({
            ...prev,
            loading: false,
            pendingEmailConfirmation: true,
          }));
        }
      } catch (err) {
        setState((prev) => ({ ...prev, loading: false, error: err as Error }));
        throw err;
      }
    },
    [loadProfileAndSetState],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      console.log(`[AuthProvider] 🔑 signIn() called`);
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        await authService.signIn({ email, password });

        const {
          data: { session },
          error: sessionError,
        } = await getSupabaseClient().auth.getSession();

        if (sessionError) {
          throw new Error(`Failed to verify session: ${sessionError.message}`);
        }
        if (!session) {
          throw new Error("Sign in succeeded but no session was created. Please try again.");
        }

        await loadProfileAndSetState(session);
        addBreadcrumb("auth_signin_complete", { method: "email" });
        console.log(`[AuthProvider] ✅ signIn() complete`);
      } catch (err) {
        setState((prev) => ({ ...prev, loading: false, error: err as Error }));
        throw err;
      }
    },
    [loadProfileAndSetState],
  );

  const signOut = useCallback(async () => {
    console.log(`[AuthProvider] 🚪 signOut() called`);
    try {
      // Disable push token before signing out (needs auth context)
      await pushTokenService.disableCurrentToken();

      // Reset security store before signing out.
      // Clears persisted biometric preferences so the next account
      // on this device starts with a clean security state.
      useSecurityStore.getState().reset();

      await authService.signOut();
      addBreadcrumb("auth_signout_complete");
      console.log(`[AuthProvider] ✅ signOut() complete`);
      // Listener handles SIGNED_OUT → clears state
    } catch (err) {
      setState((prev) => ({ ...prev, error: err as Error }));
      throw err;
    }
  }, []);

  const signInWithApple = useCallback(async () => {
    console.log(`[AuthProvider] 🍎 signInWithApple() called`);
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const { appleDisplayName } = await authService.signInWithApple();

      let {
        data: { session },
        error: sessionError,
      } = await getSupabaseClient().auth.getSession();

      if (sessionError) {
        throw new Error(`Failed to verify session: ${sessionError.message}`);
      }
      if (!session) {
        throw new Error("Apple sign-in succeeded but no session was created. Please try again.");
      }

      session = await ensureNewUserOnboarding(session);
      await loadProfileAndSetState(session);

      // Apply Apple display name AFTER profile is confirmed to exist.
      // Apple only provides the name on first authorization, so we must
      // capture it now — subsequent sign-ins won't include it.
      if (appleDisplayName) {
        try {
          await authService.updateProfile({ display_name: appleDisplayName });
          if (__DEV__) console.log(`[AuthProvider] Applied Apple display name: "${appleDisplayName}"`);
          // Refresh profile state to reflect the name change
          const updatedProfile = await authService.getMyProfileWithUserId(session.user.id);
          if (mountedRef.current) {
            setState((prev) => ({ ...prev, profile: updatedProfile }));
          }
        } catch (nameErr) {
          // Non-fatal: sign-in succeeded, name can be set later in settings
          console.warn(`[AuthProvider] ⚠️ Failed to apply Apple display name:`, nameErr);
        }
      }

      addBreadcrumb("auth_signin_complete", { method: "apple" });
      console.log(`[AuthProvider] ✅ signInWithApple() complete`);
    } catch (err: unknown) {
      const errCode = (err as Record<string, unknown>)?.code;
      if (errCode === "ERR_REQUEST_CANCELED" || errCode === "ERR_CANCELED") {
        console.log(`[AuthProvider] 🍎 Apple Sign-In cancelled by user`);
        setState((prev) => ({ ...prev, loading: false }));
        return;
      }
      setState((prev) => ({ ...prev, loading: false, error: err instanceof Error ? err : new Error(String(err)) }));
      throw err;
    }
  }, [loadProfileAndSetState, ensureNewUserOnboarding]);

  const signInWithGoogle = useCallback(async () => {
    console.log(`[AuthProvider] 🔵 signInWithGoogle() called`);
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      await authService.signInWithGoogle();

      let {
        data: { session },
        error: sessionError,
      } = await getSupabaseClient().auth.getSession();

      if (sessionError) {
        throw new Error(`Failed to verify session: ${sessionError.message}`);
      }
      if (!session) {
        throw new Error("Google sign-in succeeded but no session was created. Please try again.");
      }

      session = await ensureNewUserOnboarding(session);
      await loadProfileAndSetState(session);
      addBreadcrumb("auth_signin_complete", { method: "google" });
      console.log(`[AuthProvider] ✅ signInWithGoogle() complete`);
    } catch (err: unknown) {
      const errRecord = err as Record<string, unknown>;
      const errMsg = err instanceof Error ? err.message : String(err);
      const isCancelled =
        errRecord?.code === "SIGN_IN_CANCELLED" ||
        errRecord?.code === "12501" ||
        errMsg.includes("SIGN_IN_CANCELLED");
      if (isCancelled) {
        console.log(`[AuthProvider] 🔵 Google Sign-In cancelled by user`);
        setState((prev) => ({ ...prev, loading: false }));
        return;
      }
      setState((prev) => ({ ...prev, loading: false, error: err instanceof Error ? err : new Error(String(err)) }));
      throw err;
    }
  }, [loadProfileAndSetState, ensureNewUserOnboarding]);

  const refreshProfile = useCallback(async () => {
    if (!state.user) return;

    setState((prev) => ({
      ...prev,
      isRefreshingProfile: true,
      profileError: null,
    }));

    try {
      const profile = await authService.getMyProfile();
      setState((prev) => ({
        ...prev,
        profile,
        profileError: null,
        isRefreshingProfile: false,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        profileError: err as Error,
        isRefreshingProfile: false,
      }));
    }
  }, [state.user]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // ==========================================================================
  // MEMOIZED CONTEXT VALUE
  // ==========================================================================

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signUp,
      signIn,
      signInWithApple,
      signInWithGoogle,
      signOut,
      refreshProfile,
      clearError,
    }),
    [state, signUp, signIn, signInWithApple, signInWithGoogle, signOut, refreshProfile, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// =============================================================================
// HOOK (context consumer)
// =============================================================================

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
