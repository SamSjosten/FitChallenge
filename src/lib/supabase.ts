// src/lib/supabase.ts
// Supabase client with secure token storage

import "react-native-url-polyfill/auto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Database } from "@/types/database";
import { Config, configValidation } from "@/constants/config";

if (!configValidation.isValid && configValidation.message) {
  console.error(configValidation.message);
}

const fallbackSupabaseUrl = "https://example.invalid";
const fallbackSupabaseAnonKey = "invalid";

// Secure storage adapter for auth tokens
// Uses expo-secure-store which encrypts data on device
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      // SecureStore might fail on web or certain devices
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Fail silently - auth will still work but won't persist
      console.warn("SecureStore setItem failed");
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      console.warn("SecureStore removeItem failed");
    }
  },
};

// Create typed Supabase client
export const supabase: SupabaseClient<Database> = createClient<Database>(
  Config.supabaseUrl || fallbackSupabaseUrl,
  Config.supabaseAnonKey || fallbackSupabaseAnonKey,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // Important for React Native
      flowType: "pkce", // More secure than implicit
    },
  }
);

/**
 * Get current user ID or throw if not authenticated
 * Use this at the start of any authenticated operation
 */
export async function requireUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
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
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Wrap an operation that requires authentication
 * Automatically gets user ID and passes it to the operation
 */
export async function withAuth<T>(
  operation: (userId: string) => Promise<T>
): Promise<T> {
  const userId = await requireUserId();
  return operation(userId);
}
