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
import { syncServerTime } from "@/lib/serverTime";
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
  });

  // ==========================================================================
  // SINGLE AUTH SUBSCRIPTION (replaces duplicate subscriptions)
  // ==========================================================================
  useEffect(() => {
    let mounted = true;

    // Get initial session
    const initSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          setState((prev) => ({ ...prev, loading: false, error }));
          return;
        }

        if (session?.user) {
          // Sync server time on initial auth
          syncServerTime().catch((err) =>
            console.warn("Initial server time sync failed:", err)
          );

          // Load profile
          try {
            const profile = await authService.getMyProfile();
            if (mounted) {
              setState({
                session,
                user: session.user,
                profile,
                loading: false,
                error: null,
              });
            }
          } catch (profileError) {
            if (mounted) {
              setState({
                session,
                user: session.user,
                profile: null,
                loading: false,
                error: profileError as Error,
              });
            }
          }
        } else {
          setState({
            session: null,
            user: null,
            profile: null,
            loading: false,
            error: null,
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

    // Listen for auth changes - THE SINGLE SUBSCRIPTION
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT" || !session) {
        setState({
          session: null,
          user: null,
          profile: null,
          loading: false,
          error: null,
        });
        return;
      }

      // User signed in or token refreshed
      if (session.user) {
        // Sync server time on auth change (e.g., fresh login)
        syncServerTime().catch((err) =>
          console.warn("Server time sync on auth change failed:", err)
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
            });
          }
        } catch (err) {
          if (mounted) {
            setState({
              session,
              user: session.user,
              profile: null,
              loading: false,
              error: err as Error,
            });
          }
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ==========================================================================
  // AUTH ACTIONS
  // ==========================================================================

  const signUp = useCallback(
    async (email: string, password: string, username: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        await authService.signUp({ email, password, username });
        // Auth state change listener will handle the rest
      } catch (err) {
        setState((prev) => ({ ...prev, loading: false, error: err as Error }));
        throw err;
      }
    },
    []
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
    [state, signUp, signIn, signOut, refreshProfile, clearError]
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
