// src/providers/AuthProvider.tsx
// Centralized auth state provider - SINGLE source of truth for authentication

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { Session, User, AuthError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
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

  // ==========================================================================
  // SINGLE AUTH SUBSCRIPTION (replaces duplicate subscriptions)
  // ==========================================================================
  useEffect(() => {
    let mounted = true;
    let initialLoadHandled = false; // Prevent race between initSession and onAuthStateChange

    // Helper to load profile with the session we already have
    const loadProfileAndSetState = async (session: Session) => {
      // Sync server time (non-blocking)
      syncServerTime().catch((err) =>
        console.warn("Server time sync failed:", err),
      );

      try {
        const profile = await authService.getMyProfile();
        if (mounted) {
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
            .catch((err) =>
              console.warn("Push token registration failed:", err),
            );
        }
      } catch (err) {
        if (mounted) {
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
    };

    // Get initial session
    const initSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!mounted || initialLoadHandled) return;
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
        if (mounted) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: err as Error,
          }));
        }
      }
    };

    initSession();

    // Safety timeout: ensure loading clears even if something hangs
    const safetyTimeout = setTimeout(() => {
      if (mounted) {
        setState((prev) => {
          if (prev.loading) {
            console.warn(
              "Auth initialization timed out, clearing loading state",
            );
            return { ...prev, loading: false };
          }
          return prev;
        });
      }
    }, 10000); // 10 second safety net

    // Listen for auth changes - THE SINGLE SUBSCRIPTION
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      // Skip INITIAL_SESSION if initSession already handled it
      if (event === "INITIAL_SESSION" && initialLoadHandled) {
        return;
      }

      // Mark as handled if this is the initial session event
      if (event === "INITIAL_SESSION") {
        initialLoadHandled = true;
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

      // User signed in or token refreshed
      if (session.user) {
        await loadProfileAndSetState(session);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  // ==========================================================================
  // PERIODIC SERVER TIME SYNC
  // ==========================================================================
  useEffect(() => {
    // Only run interval when authenticated
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
        const { session } = await authService.signUp({
          email,
          password,
          username,
        });
        // If no session returned, email confirmation is pending
        // Explicitly clear loading - don't rely solely on onAuthStateChange
        setState((prev) => ({
          ...prev,
          loading: false,
          pendingEmailConfirmation: !session,
        }));
        // If session exists, onAuthStateChange will handle user/profile setup
      } catch (err) {
        setState((prev) => ({ ...prev, loading: false, error: err as Error }));
        throw err;
      }
    },
    [],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      await authService.signIn({ email, password });
      // Auth state change listener will handle the rest
    } catch (err) {
      setState((prev) => ({ ...prev, loading: false, error: err as Error }));
      throw err;
    }
  }, []);

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
