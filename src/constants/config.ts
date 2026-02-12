// src/constants/config.ts
// Environment configuration for FitChallenge

export const Config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || "",
  enableAnalytics: process.env.NODE_ENV === "production",
  // Realtime subscriptions - disable with EXPO_PUBLIC_ENABLE_REALTIME=false
  enableRealtime: process.env.EXPO_PUBLIC_ENABLE_REALTIME !== "false",
  // E2E mode — set via EXPO_PUBLIC_E2E=true in .env BEFORE building.
  // Disables non-essential startup instrumentation (Sentry.wrap, query
  // persistence, notification polling) so Detox synchronization can
  // detect app idle state. This is a BUILD-TIME flag inlined by Metro;
  // Detox launchArgs do NOT reach process.env.
  isE2E: process.env.EXPO_PUBLIC_E2E === "true",
};

export interface ConfigValidation {
  missing: string[];
  isValid: boolean;
  message: string | null;
}

// Validate required config at startup
export function validateConfig(): ConfigValidation {
  const missing: string[] = [];

  if (!Config.supabaseUrl) {
    missing.push("EXPO_PUBLIC_SUPABASE_URL");
  }
  if (!Config.supabaseAnonKey) {
    missing.push("EXPO_PUBLIC_SUPABASE_ANON_KEY");
  }

  if (missing.length === 0) {
    return {
      missing,
      isValid: true,
      message: null,
    };
  }

  return {
    missing,
    isValid: false,
    message:
      `Missing required environment variables: ${missing.join(", ")}. ` +
      `Copy .env.example to .env and fill in your Supabase credentials.`,
  };
}

export const configValidation = validateConfig();
