// app/_layout.tsx
// Root layout with providers and auth routing
//
// GUARDRAIL 0: Non-blocking hydration
// GUARDRAIL 1: Preserves auth storage adapter
// GUARDRAIL 2: Query persistence with selective caching
// GUARDRAIL 3: Offline queue processing

// CRITICAL: This polyfill must be imported BEFORE any module that uses crypto.getRandomValues
// It provides the global crypto.getRandomValues for React Native
import "react-native-get-random-values";

import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { useNotificationHandler } from "@/hooks/useNotificationHandler";
import { useStorageWarnings } from "@/hooks/useStorageWarnings";
import { ThemeProvider, useAppTheme } from "@/providers/ThemeProvider";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { ProfileErrorBoundary } from "@/components/ProfileErrorBoundary";
import { ConfigurationErrorScreen } from "@/components/ConfigurationError";
import { ToastProvider, useToast } from "@/providers/ToastProvider";
import { ServerTimeBanner } from "@/components/ServerTimeBanner";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { supabaseConfigError } from "@/lib/supabase";
import { configureForegroundHandler, setupNotificationChannel } from "@/lib/notifications";
import { persistOptions } from "@/lib/queryPersister";
import { queryRetryFn, mutationRetryFn } from "@/lib/queryRetry";
import { initSentry, setUserContext } from "@/lib/sentry";
import { useOfflineStore } from "@/stores/offlineStore";
import { useNavigationStore, initNavigationStoreRecovery } from "@/stores/navigationStore";

import * as Sentry from "@sentry/react-native";

// =============================================================================
// MODULE-LEVEL SETUP (runs once at import time)
// =============================================================================

Sentry.init({
  dsn: "https://5355753a2ebdf238435764f54c6b1f57@o4510739478478848.ingest.us.sentry.io/4510739480576000",
  sendDefaultPii: true,
  enableLogs: true,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],
});

initSentry();

// Configure foreground notification display
configureForegroundHandler();

// =============================================================================
// QUERY CLIENT
// =============================================================================

// GUARDRAIL 2: Maintain current retry policies
// gcTime must be >= maxAge for persistence to work properly
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours (>= maxAge for persistence)
      retry: queryRetryFn, // Smart retry: skips auth/RLS errors
    },
    mutations: {
      retry: mutationRetryFn, // Conservative: only network errors
    },
  },
});

// =============================================================================
// ROOT LAYOUT NAV (authenticated shell)
// =============================================================================

function RootLayoutNav() {
  const { colors, isDark } = useAppTheme();
  const { showToast } = useToast();
  // Use centralized auth state - NO MORE DUPLICATE SUBSCRIPTION
  const {
    session,
    loading: isLoading,
    profile,
    profileError,
    isRefreshingProfile,
    refreshProfile,
    signOut,
  } = useAuth();
  // GUARDRAIL 1: Surface storage degradation warnings
  useStorageWarnings(session, showToast);

  // GUARDRAIL 3: Network status monitoring
  const { isConnected } = useNetworkStatus();

  // GUARDRAIL 3: Offline queue state
  const processQueue = useOfflineStore((s) => s.processQueue);
  const queueLength = useOfflineStore((s) => s.queue.length);

  // Protected route logic - uses only session, not profile
  useProtectedRoute(session, isLoading);

  // Initialize navigation store recovery listener (for stale lock cleanup)
  useEffect(() => {
    initNavigationStoreRecovery();
    // No cleanup needed - listener persists for app lifetime
  }, []);

  // Update Sentry user context on auth state change
  useEffect(() => {
    if (session?.user?.id) {
      setUserContext({ id: session.user.id });
    } else {
      setUserContext(null);
    }
  }, [session?.user?.id]);

  // GUARDRAIL 3: Process offline queue when authenticated and online
  useEffect(() => {
    if (session?.user?.id && isConnected && queueLength > 0) {
      processQueue().catch((error) => {
        console.error("[RootLayout] Queue processing failed:", error);
      });
    }
  }, [session?.user?.id, isConnected, queueLength, processQueue]);

  // GUARDRAIL 4: Enable realtime updates when logged in
  useRealtimeSubscription();

  // Check if navigation is locked (auth is handling navigation)
  const isNavigationLocked = useNavigationStore((s) => s.isNavigationLocked);

  // Set up Android notification channel on mount
  useEffect(() => {
    setupNotificationChannel();
  }, []);

  // Handle notification taps for deep linking
  useNotificationHandler();

  // Show loading spinner ONLY if not navigation-locked
  // When locked, auth screen is handling sign-in and needs to stay mounted
  // to show the biometric setup modal
  if (isLoading && !isNavigationLocked()) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      {/* Show time sync warning when logged in and sync has failed */}
      {session && <ServerTimeBanner />}
      {/* GUARDRAIL 5: Show offline/sync indicator when logged in */}
      {session && (
        <View style={styles.offlineIndicatorContainer}>
          <OfflineIndicator />
        </View>
      )}
      {/* Profile error boundary - shows retry UI if profile fails to load */}
      <ProfileErrorBoundary
        error={session ? profileError : null}
        isRetrying={isRefreshingProfile}
        onRetry={refreshProfile}
      >
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTintColor: colors.primary.main,
            headerTitleStyle: {
              fontWeight: "600",
              fontFamily: "PlusJakartaSans_600SemiBold",
            },
            contentStyle: {
              backgroundColor: colors.background,
            },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="(auth)"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="challenge/create"
            options={{
              title: "Create Challenge",
              presentation: "modal",
            }}
          />
          <Stack.Screen
            name="challenge/[id]"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="notifications"
            options={{
              title: "Notifications",
            }}
          />
          <Stack.Screen
            name="settings"
            options={{
              title: "Settings",
            }}
          />
        </Stack>
      </ProfileErrorBoundary>
    </GestureHandlerRootView>
  );
}

// =============================================================================
// ROOT LAYOUT (provider tree)
// =============================================================================

export default Sentry.wrap(function RootLayout() {
  // GUARDRAIL 0: Block app if Supabase config is invalid (production error screen)
  if (supabaseConfigError) {
    return (
      <SafeAreaProvider>
        <ConfigurationErrorScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      {/* GUARDRAIL 0: Non-blocking hydration via PersistQueryClientProvider */}
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={persistOptions}
        onSuccess={() => {
          console.log("[QueryPersister] Cache hydrated");
        }}
      >
        <AuthProvider>
          <ThemeProvider>
            <ToastProvider>
              <RootLayoutNav />
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
});

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  offlineIndicatorContainer: {
    position: "absolute",
    top: 50, // Below status bar
    right: 16,
    zIndex: 1000,
  },
});
