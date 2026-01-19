// src/constants/config.ts
// Environment configuration for FitChallenge

export const Config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || "",
  enableAnalytics: process.env.NODE_ENV === "production",
  // Realtime subscriptions - disable with EXPO_PUBLIC_ENABLE_REALTIME=false
  enableRealtime: process.env.EXPO_PUBLIC_ENABLE_REALTIME !== "false",
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
