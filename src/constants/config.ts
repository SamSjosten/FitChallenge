// src/constants/config.ts
// Environment configuration for FitChallenge

export const Config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
  enableAnalytics: process.env.NODE_ENV === 'production',
};

// Validate required config at startup
export function validateConfig(): void {
  if (!Config.supabaseUrl) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL is required');
  }
  if (!Config.supabaseAnonKey) {
    throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY is required');
  }
}
