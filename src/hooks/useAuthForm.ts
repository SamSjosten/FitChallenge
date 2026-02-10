// src/hooks/useAuthForm.ts
// Auth form state management with Zod validation.
//
// Replaces hand-rolled regex validation in auth.tsx with proper Zod schemas
// from src/lib/validation.ts. Encapsulates form state, validation, submit,
// and remember-me logic.
//
// The hook does NOT handle navigation or biometric flows — those are
// screen-level concerns. It returns a submitAuth() result for the screen
// to orchestrate navigation locks and biometric setup.

import { useState, useEffect, useRef, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { signUpSchema, signInSchema } from "@/lib/validation";

// =============================================================================
// TYPES
// =============================================================================

export type AuthMode = "signup" | "signin";

export interface AuthSubmitResult {
  /** Whether the auth call succeeded */
  success: boolean;
  /** Credentials on success (for biometric setup prompt) */
  credentials?: { email: string; password: string };
  /** Error message on failure */
  error?: string;
}

interface UseAuthFormConfig {
  /** signIn from AuthProvider — routes through provider's state machine */
  signIn: (email: string, password: string) => Promise<void>;
  /** signUp from AuthProvider */
  signUp: (email: string, password: string, username: string) => Promise<void>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const REMEMBER_EMAIL_KEY = "fitchallenge_remembered_email";

// =============================================================================
// HOOK
// =============================================================================

export function useAuthForm(
  config: UseAuthFormConfig,
  initialMode: AuthMode = "signup",
) {
  const { signIn, signUp } = config;

  // ── Form State ──────────────────────────────────────────────────────────
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rememberMe, setRememberMe] = useState(false);

  // Track mounted state for async safety
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // ── Load Saved Email ────────────────────────────────────────────────────
  useEffect(() => {
    const loadSavedEmail = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem(REMEMBER_EMAIL_KEY);
        if (savedEmail && isMounted.current) {
          setEmail(savedEmail);
          setRememberMe(true);
        }
      } catch (error) {
        console.error("Failed to load saved email:", error);
      }
    };
    loadSavedEmail();
  }, []);

  // ── Field Handlers ──────────────────────────────────────────────────────

  /** Sanitize username input to lowercase alphanumeric + underscores */
  const handleUsernameChange = useCallback((text: string) => {
    const sanitized = text.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setUsername(sanitized);
  }, []);

  const toggleShowPassword = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  /** Switch between sign-in and sign-up modes, clearing errors */
  const switchMode = useCallback((newMode: AuthMode) => {
    setMode(newMode);
    setErrors({});
  }, []);

  /** Clear just the general error banner (e.g. after user dismisses it) */
  const clearGeneralError = useCallback(() => {
    setErrors((prev) => {
      const { general: _, ...rest } = prev;
      return rest;
    });
  }, []);

  // ── Validation ──────────────────────────────────────────────────────────

  /**
   * Validate form fields using Zod schemas from validation.ts.
   *
   * Sign-up uses: signUpSchema (email + passwordSchema + usernameSchema)
   *   - Password: min 8 chars, uppercase, lowercase, digit
   *   - Username: 3-20 chars, alphanumeric + underscore
   *   - Email: proper email validation
   *
   * Sign-in uses: signInSchema (email + password min 1)
   *
   * Sets per-field errors internally. Returns true if valid.
   */
  const validateForm = useCallback((): boolean => {
    const schema = mode === "signup" ? signUpSchema : signInSchema;
    const data =
      mode === "signup" ? { email, password, username } : { email, password };

    const result = schema.safeParse(data);

    if (!result.success) {
      const newErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0]?.toString() || "general";
        // Keep only the first error per field for cleaner UX
        if (!newErrors[field]) {
          newErrors[field] = issue.message;
        }
      }
      setErrors(newErrors);
      return false;
    }

    setErrors({});
    return true;
  }, [mode, email, password, username]);

  // ── Submit ──────────────────────────────────────────────────────────────

  /**
   * Execute the auth call (signIn or signUp) and handle remember-me.
   *
   * Sets isLoading(true) on start. On error, sets isLoading(false) and
   * returns the error. On success, the caller is responsible for setting
   * isLoading(false) after handling navigation/biometric setup.
   *
   * Call validateForm() before this — submitAuth does NOT re-validate.
   */
  const submitAuth = useCallback(async (): Promise<AuthSubmitResult> => {
    setIsLoading(true);

    try {
      // Apply email normalization (Zod transforms would do this too,
      // but we need the raw string for the auth call)
      const trimmedEmail = email.toLowerCase().trim();

      if (mode === "signin") {
        await signIn(trimmedEmail, password);

        // Persist or clear remembered email
        if (rememberMe) {
          await AsyncStorage.setItem(REMEMBER_EMAIL_KEY, trimmedEmail);
        } else {
          await AsyncStorage.removeItem(REMEMBER_EMAIL_KEY);
        }
      } else {
        const normalizedUsername = username.toLowerCase();
        await signUp(trimmedEmail, password, normalizedUsername);
      }

      return {
        success: true,
        credentials: { email: trimmedEmail, password },
      };
    } catch (error: any) {
      if (isMounted.current) {
        setIsLoading(false);
      }
      return {
        success: false,
        error: error.message || "Authentication failed",
      };
    }
  }, [mode, email, password, username, rememberMe, signIn, signUp]);

  // ── Return ──────────────────────────────────────────────────────────────

  return {
    // State
    mode,
    email,
    password,
    username,
    showPassword,
    isLoading,
    errors,
    rememberMe,

    // Setters
    setEmail,
    setPassword,
    handleUsernameChange,
    toggleShowPassword,
    switchMode,
    setRememberMe,
    setErrors,
    setIsLoading,
    clearGeneralError,

    // Actions
    validateForm,
    submitAuth,
  };
}
