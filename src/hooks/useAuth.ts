// src/hooks/useAuth.ts
// Authentication state hook

import { useEffect, useState, useCallback } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { authService } from '@/services/auth';
import type { Profile } from '@/types/database';

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

interface UseAuthReturn extends AuthState {
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    loading: true,
    error: null,
  });

  // Load initial session and subscribe to changes
  useEffect(() => {
    let mounted = true;

    // Get initial session
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          setState(prev => ({ ...prev, loading: false, error }));
          return;
        }

        if (session?.user) {
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
          setState(prev => ({ 
            ...prev, 
            loading: false, 
            error: err as Error 
          }));
        }
      }
    };

    initSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_OUT' || !session) {
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
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Sign up handler
  const signUp = useCallback(async (
    email: string,
    password: string,
    username: string
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      await authService.signUp({ email, password, username });
      // Auth state change listener will handle the rest
    } catch (err) {
      setState(prev => ({ ...prev, loading: false, error: err as Error }));
      throw err;
    }
  }, []);

  // Sign in handler
  const signIn = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      await authService.signIn({ email, password });
      // Auth state change listener will handle the rest
    } catch (err) {
      setState(prev => ({ ...prev, loading: false, error: err as Error }));
      throw err;
    }
  }, []);

  // Sign out handler
  const signOut = useCallback(async () => {
    try {
      await authService.signOut();
      // Auth state change listener will handle the rest
    } catch (err) {
      setState(prev => ({ ...prev, error: err as Error }));
      throw err;
    }
  }, []);

  // Refresh profile manually
  const refreshProfile = useCallback(async () => {
    if (!state.user) return;
    try {
      const profile = await authService.getMyProfile();
      setState(prev => ({ ...prev, profile }));
    } catch (err) {
      setState(prev => ({ ...prev, error: err as Error }));
    }
  }, [state.user]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    signUp,
    signIn,
    signOut,
    refreshProfile,
    clearError,
  };
}
