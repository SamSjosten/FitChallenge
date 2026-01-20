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
// TYPES
// =============================================================================

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: AuthError | Error | null;
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
    error: null,
    pendingEmailConfirmation: false,
  });

  // Track mounted state for async operations
  const mountedRef = useRef(true);

  // Track if signIn/signUp has explicitly handled the auth event
  // Prevents listener from redundantly processing the same event
  const authActionHandledRef = useRef(false);

  // ==========================================================================
  // PROFILE LOADING HELPER
  // ==========================================================================

  /**
   * Load user profile and set authenticated state.
   * Used by initialization, signIn, signUp, and auth listener.
   */
  const loadProfileAndSetState = useCallback(async (session: Session) => {
    // Sync server time (non-blocking)
    syncServerTime().catch((err) =>
      console.warn("Server time sync failed:", err),
    );

    try {
      const profile = await authService.getMyProfile();
      if (mountedRef.current) {
        setState({
          session,
          user: session.user,
          profile,
          loading: false,
          error: null,
          pendingEmailConfirmation: false,
        });

        // Register push token if permission already granted (non-blocking)
        pushTokenService
          .registerToken()
          .catch((err) => console.warn("Push token registration failed:", err));
      }
    } catch (err) {
      if (mountedRef.current) {
        setState({
          session,
          user: session.user,
          profile: null,
          loading: false,
          error: err as Error,
          pendingEmailConfirmation: false,
        });
      }
    }
  }, []);

  // ==========================================================================
  // AUTH INITIALIZATION & SUBSCRIPTION
  // ==========================================================================

  useEffect(() => {
    // Reset mounted ref on mount
    mountedRef.current = true;
    let initialLoadHandled = false;

    const initSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await getSupabaseClient().auth.getSession();

        if (!mountedRef.current || initialLoadHandled) return;
        initialLoadHandled = true;

        if (error) {
          setState((prev) => ({ ...prev, loading: false, error }));
          return;
        }

        if (session?.user) {
          await loadProfileAndSetState(session);
        } else {
          setState({
            session: null,
            user: null,
            profile: null,
            loading: false,
            error: null,
            pendingEmailConfirmation: false,
          });
        }
      } catch (err) {
        if (mountedRef.current) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: err as Error,
          }));
        }
      }
    };

    initSession();

    // Safety timeout: set explicit error if auth hangs
    const safetyTimeout = setTimeout(() => {
      if (mountedRef.current) {
        setState((prev) => {
          if (prev.loading) {
            console.warn("Auth initialization timed out");
            return {
              ...prev,
              loading: false,
              error: new Error(
                "Authentication timed out. Please check your connection and try again.",
              ),
            };
          }
          return prev;
        });
      }
    }, 10000);

    // Listen for auth changes - BACKUP mechanism for token refresh, sign out, etc.
    const {
      data: { subscription },
    } = getSupabaseClient().auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) return;

      // Skip INITIAL_SESSION if initSession already handled it
      if (event === "INITIAL_SESSION" && initialLoadHandled) {
        return;
      }

      if (event === "INITIAL_SESSION") {
        initialLoadHandled = true;
      }

      // Skip SIGNED_IN if signIn/signUp already handled it explicitly
      if (event === "SIGNED_IN" && authActionHandledRef.current) {
        authActionHandledRef.current = false; // Reset for future auth actions
        return;
      }

      if (event === "SIGNED_OUT" || !session) {
        setState({
          session: null,
          user: null,
          profile: null,
          loading: false,
          error: null,
          pendingEmailConfirmation: false,
        });
        return;
      }

      // Token refresh or external auth change
      if (session.user) {
        await loadProfileAndSetState(session);
      }
    });

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
        authActionHandledRef.current = true;

        // Explicitly load profile and set state
        await loadProfileAndSetState(session);
      } catch (err) {
        setState((prev) => ({ ...prev, loading: false, error: err as Error }));
        throw err;
      }
    },
    [loadProfileAndSetState],
  );

  const signOut = useCallback(async () => {
    try {
      // Disable push token before signing out (needs auth context)
      await pushTokenService.disableCurrentToken();
      await authService.signOut();
      // Auth state change listener will handle the rest
    } catch (err) {
      setState((prev) => ({ ...prev, error: err as Error }));
      throw err;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!state.user) return;
    try {
      const profile = await authService.getMyProfile();
      setState((prev) => ({ ...prev, profile }));
    } catch (err) {
      setState((prev) => ({ ...prev, error: err as Error }));
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
