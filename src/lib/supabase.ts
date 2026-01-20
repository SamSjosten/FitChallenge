// src/lib/supabase.ts
// Supabase client with resilient token storage

import "react-native-url-polyfill/auto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";
import { Config, configValidation } from "@/constants/config";
import {
  createResilientStorageAdapter,
  getStorageStatus,
  isStorageProbeComplete,
  storageProbePromise,
  type StorageStatus,
} from "./storageProbe";

// =============================================================================
// CONFIGURATION VALIDATION
// =============================================================================

/**
 * Configuration error message, or null if config is valid.
 * Used by _layout.tsx to render error screen in production.
 */
export const supabaseConfigError: string | null = configValidation.isValid
  ? null
  : configValidation.message;

// Fail-fast in development — immediate console feedback
if (__DEV__ && !configValidation.isValid) {
  throw new Error(
    `[FitChallenge] Configuration Error: ${configValidation.message}`,
  );
}

// Log in production for crash reporting diagnostics
if (!__DEV__ && !configValidation.isValid) {
  console.error(
    `[FitChallenge] Configuration Error: ${configValidation.message}`,
  );
}

// =============================================================================
// STORAGE STATUS EXPORTS
// =============================================================================

// Re-export storage status utilities for UI components
export {
  getStorageStatus,
  isStorageProbeComplete,
  storageProbePromise,
  type StorageStatus,
};

// =============================================================================
// RESILIENT STORAGE ADAPTER
// =============================================================================

// Uses storageProbe to detect best available storage and fall back gracefully
// See src/lib/storageProbe.ts for implementation details
const ResilientStorageAdapter = createResilientStorageAdapter();

// =============================================================================
// SUPABASE CLIENT
// =============================================================================

/** Lazily initialized client instance */
let supabaseClient: SupabaseClient<Database> | null = null;

/**
 * Get the Supabase client instance.
 *
 * Throws an explicit error if configuration is invalid, ensuring fail-fast
 * behavior regardless of when/where the client is accessed.
 *
 * The client is lazily initialized on first call and cached thereafter.
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (!configValidation.isValid) {
    throw new Error(
      `[FitChallenge] Supabase client unavailable: ${configValidation.message}`,
    );
  }

  if (!supabaseClient) {
    supabaseClient = createClient<Database>(
      Config.supabaseUrl,
      Config.supabaseAnonKey,
      {
        auth: {
          storage: ResilientStorageAdapter,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false, // Important for React Native
          flowType: "pkce", // More secure than implicit
        },
      },
    );
  }

  return supabaseClient;
}

/**
 * Get current user ID or throw if not authenticated
 * Use this at the start of any authenticated operation
 */
export async function requireUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await getSupabaseClient().auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Authentication required");
  return user.id;
}

/**
 * Get current user ID or null if not authenticated
 * Use this for conditional checks
 */
export async function getUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await getSupabaseClient().auth.getUser();
  return user?.id ?? null;
}

/**
 * Wrap an operation that requires authentication
 * Automatically gets user ID and passes it to the operation
 */
export async function withAuth<T>(
  operation: (userId: string) => Promise<T>,
): Promise<T> {
  const userId = await requireUserId();
  return operation(userId);
}
