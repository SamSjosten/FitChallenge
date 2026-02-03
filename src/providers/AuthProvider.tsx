// src/providers/AuthProvider.tsx
// Centralized auth state provider - SINGLE source of truth for authentication

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
import { getSupabaseClient } from "@/lib/supabase";
import { authService } from "@/services/auth";
import { pushTokenService } from "@/services/pushTokens";
import { syncServerTime, RESYNC_INTERVAL_MS } from "@/lib/serverTime";
import type { Profile } from "@/types/database";

// =============================================================================
// ERRORS
// =============================================================================

/**
 * Structured error for auth timeout.
 * UI can check `error.code === 'AUTH_TIMEOUT'` or `error instanceof AuthTimeoutError`
 */
export class AuthTimeoutError extends Error {
  readonly code = "AUTH_TIMEOUT" as const;

  constructor(
    message = "Authentication timed out. Please check your connection and try again.",
  ) {
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

  // Track mounted state for async operations
  const mountedRef = useRef(true);

  // Track if signIn/signUp has explicitly handled the auth event
  // Prevents listener from redundantly processing the same event
  const authActionHandledRef = useRef(false);

  // Guard against concurrent profile loading
  const profileLoadingRef = useRef(false);

  // ==========================================================================
  // PROFILE LOADING HELPER
  // ==========================================================================

  /**
   * Load user profile and set authenticated state.
   * Used by initialization, signIn, signUp, and auth listener.
   *
   * IMPORTANT: Sets session immediately, then loads profile.
   * This ensures ProtectedRoute sees the session even if profile loading is slow.
   * Profile errors are stored separately so they don't block auth state.
   */
  const loadProfileAndSetState = useCallback(async (session: Session) => {
    // Guard against concurrent calls - check and set atomically
    if (profileLoadingRef.current) {
      console.log(
        `[AuthProvider] ⏭️ loadProfileAndSetState skipped - already loading`,
      );
      return;
    }
    profileLoadingRef.current = true;
    console.log(
      `[AuthProvider] 📂 loadProfileAndSetState starting for user ${session.user.id.substring(0, 8)}...`,
    );

    // Set session IMMEDIATELY so ProtectedRoute knows user is authenticated
    // This prevents timeout-induced redirects while profile is loading
    setState((prev) => ({
      ...prev,
      session,
      user: session.user,
      loading: false, // Auth is complete - we have a session
      profileError: null, // Clear any previous profile errors
      // profile stays null until it loads
    }));

    // Sync server time (non-blocking)
    syncServerTime().catch((err) =>
      console.warn("Server time sync failed:", err),
    );

    try {
      // Use getMyProfileWithUserId to avoid redundant getUser() call during initialization
      // We already have the userId from the session
      const profile = await authService.getMyProfileWithUserId(session.user.id);

      if (mountedRef.current) {
        console.log(
          `[AuthProvider] ✅ Profile loaded, setting complete auth state`,
        );
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
        console.log(`[AuthProvider] ⚠️ Component unmounted before setState`);
      }
    } catch (err) {
      console.error("[AuthProvider] Error fetching profile:", err);
      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          profile: null,
          profileError: err as Error,
          // Keep session and user - user is still authenticated, just profile failed
        }));
      }
    } finally {
      profileLoadingRef.current = false;
    }
  }, []);

  // ==========================================================================
  // AUTH INITIALIZATION & SUBSCRIPTION
  // ==========================================================================

  useEffect(() => {
    // Reset mounted ref on mount
    mountedRef.current = true;

    // Track if we've processed the initial session
    let initialSessionProcessed = false;

    // ==========================================================================
    // AUTH EVENT CONTRACT
    // ==========================================================================
    // INITIAL_SESSION: Auth is fully initialized - safe to make database queries
    // TOKEN_REFRESHED: Token refreshed - only process AFTER INITIAL_SESSION
    // SIGNED_IN: User signed in - only process AFTER INITIAL_SESSION
    // SIGNED_OUT: User signed out - always process
    //
    // RULE: Only make authenticated database queries after INITIAL_SESSION.
    // Before that, the Supabase client's auth context may not be ready for RLS.
    // ==========================================================================
    const {
      data: { subscription },
    } = getSupabaseClient().auth.onAuthStateChange(async (event, session) => {
      // DIAGNOSTIC: Log every auth event
      console.log(
        `[AuthProvider] 📡 onAuthStateChange: event=${event}, session=${session ? "YES" : "NO"}, initialProcessed=${initialSessionProcessed}, actionHandled=${authActionHandledRef.current}`,
      );

      if (!mountedRef.current) {
        console.log(`[AuthProvider] ⚠️ Ignoring event - component unmounted`);
        return;
      }

      // During initial startup, SIGNED_IN often fires before INITIAL_SESSION
      // Skip SIGNED_IN if we haven't processed INITIAL_SESSION yet - it will handle auth
      if (event === "SIGNED_IN" && !initialSessionProcessed) {
        console.log(
          `[AuthProvider] ⏭️ Skipping SIGNED_IN - initial session not yet processed`,
        );
        return;
      }

      // Skip SIGNED_IN if signIn/signUp already handled it explicitly
      if (event === "SIGNED_IN" && authActionHandledRef.current) {
        console.log(
          `[AuthProvider] ⏭️ Skipping SIGNED_IN - already handled by signIn/signUp`,
        );
        authActionHandledRef.current = false; // Reset for future auth actions
        return;
      }

      // TOKEN_REFRESHED before INITIAL_SESSION: Skip entirely
      // During startup, Supabase fires TOKEN_REFRESHED for cached tokens.
      // Don't start profile queries here - INITIAL_SESSION will handle it.
      // This avoids a race where the first query hangs (Supabase client not fully ready)
      // while INITIAL_SESSION's query succeeds.
      if (event === "TOKEN_REFRESHED" && !initialSessionProcessed) {
        console.log(
          `[AuthProvider] ⏭️ Skipping TOKEN_REFRESHED - waiting for INITIAL_SESSION`,
        );
        return;
      }

      if (event === "SIGNED_OUT" || !session) {
        console.log(
          `[AuthProvider] 🚪 Processing sign out (event=${event}, session=${session ? "YES" : "NO"})`,
        );
        initialSessionProcessed = true; // Mark as processed even for signed out
        authActionHandledRef.current = false; // Reset for next sign-in (fixes biometric sign-in after sign-out)
        console.log(`[AuthProvider] 🔄 Reset authActionHandledRef = false`);
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

      // Mark INITIAL_SESSION as processed
      if (event === "INITIAL_SESSION") {
        console.log(`[AuthProvider] 🎬 Processing INITIAL_SESSION`);
        initialSessionProcessed = true;
      }

      // INITIAL_SESSION, SIGNED_IN (after initial), TOKEN_REFRESHED (after initial) - load profile
      if (session.user) {
        console.log(`[AuthProvider] 👤 Loading profile for event=${event}`);
        await loadProfileAndSetState(session);
      }
    });

    // Safety timeout: if INITIAL_SESSION never fires (corrupted storage, etc)
    // This catches the case where Supabase auth is completely stuck
    const safetyTimeout = setTimeout(() => {
      if (mountedRef.current) {
        setState((prev) => {
          if (prev.loading) {
            console.warn(
              "[AuthProvider] Auth initialization timed out - INITIAL_SESSION never fired",
            );
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
      syncServerTime().catch((err) =>
        console.warn("Periodic server time sync failed:", err),
      );
    }, RESYNC_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [state.session]);

  // ==========================================================================
  // AUTH ACTIONS
  // ==========================================================================

  const signUp = useCallback(
    async (email: string, password: string, username: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const { session: returnedSession } = await authService.signUp({
          email,
          password,
          username,
        });

        if (returnedSession) {
          // Auto-confirm enabled - explicitly verify session
          const {
            data: { session },
            error: sessionError,
          } = await getSupabaseClient().auth.getSession();

          if (sessionError) {
            throw new Error(
              `Failed to verify session: ${sessionError.message}`,
            );
          }

          if (!session) {
            throw new Error(
              "Sign up succeeded but no session was created. Please try again.",
            );
          }

          // Mark as handled so listener doesn't duplicate work
          authActionHandledRef.current = true;

          // Explicitly load profile and set state
          await loadProfileAndSetState(session);
        } else {
          // Email confirmation required
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

        // Explicitly fetch session - don't rely on listener
        const {
          data: { session },
          error: sessionError,
        } = await getSupabaseClient().auth.getSession();

        if (sessionError) {
          throw new Error(`Failed to verify session: ${sessionError.message}`);
        }

        if (!session) {
          throw new Error(
            "Sign in succeeded but no session was created. Please try again.",
          );
        }

        // Mark as handled so listener doesn't duplicate work
        console.log(`[AuthProvider] 🏷️ Setting authActionHandledRef = true`);
        authActionHandledRef.current = true;

        // Explicitly load profile and set state
        await loadProfileAndSetState(session);
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
      await authService.signOut();
      console.log(`[AuthProvider] ✅ signOut() complete`);
      // Auth state change listener will handle the rest
    } catch (err) {
      setState((prev) => ({ ...prev, error: err as Error }));
      throw err;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!state.user) return;

    // Set refreshing state for UI feedback
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
      signOut,
      refreshProfile,
      clearError,
    }),
    [state, signUp, signIn, signOut, refreshProfile, clearError],
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
