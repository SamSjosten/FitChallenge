// src/constants/config.ts
// Environment configuration for FitChallenge

export const Config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || "",
  enableAnalytics: process.env.NODE_ENV === "production",
};

// Validate required config at startup
export function validateConfig(): void {
  const missing: string[] = [];

  if (!Config.supabaseUrl) {
    missing.push("EXPO_PUBLIC_SUPABASE_URL");
  }
  if (!Config.supabaseAnonKey) {
    missing.push("EXPO_PUBLIC_SUPABASE_ANON_KEY");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        `Copy .env.example to .env and fill in your Supabase credentials.`
    );
  }
}
