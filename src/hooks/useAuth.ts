// src/hooks/useAuth.ts
// Authentication hook - re-exports from centralized AuthProvider
//
// This file exists for backward compatibility. All auth logic is now
// centralized in AuthProvider to prevent duplicate subscriptions.

export { useAuth } from "@/providers/AuthProvider";

// Re-export types for consumers that may need them
export type { Profile } from "@/types/database";
