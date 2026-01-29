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

import React, { useEffect, useRef, useState } from "react";
import {
  Stack,
  useRouter,
  useSegments,
  useRootNavigationState,
} from "expo-router";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { StatusBar } from "expo-status-bar";
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Text,
  AppState,
  AppStateStatus,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { ThemeProvider, useAppTheme } from "@/providers/ThemeProvider";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { ToastProvider } from "@/providers/ToastProvider";
import { ServerTimeBanner, OfflineIndicator } from "@/components/ui";
import {
  supabaseConfigError,
  getStorageStatus,
  storageProbePromise,
  subscribeToStorageStatus,
} from "@/lib/supabase";
import { persistOptions } from "@/lib/queryPersister";
import { queryRetryFn, mutationRetryFn } from "@/lib/queryRetry";
import { initSentry, setUserContext } from "@/lib/sentry";
import { useOfflineStore } from "@/stores/offlineStore";
import { useSecurityStore } from "@/stores/securityStore";
import BiometricLockScreen from "@/components/BiometricLockScreen";
import { useToast } from "@/providers/ToastProvider";
import type { Session } from "@supabase/supabase-js";
import * as Sentry from "@sentry/react-native";
import { useFeatureFlags } from "@/lib/featureFlags";

Sentry.init({
  dsn: "https://5355753a2ebdf238435764f54c6b1f57@o4510739478478848.ingest.us.sentry.io/4510739480576000",

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [
    Sentry.mobileReplayIntegration(),
    Sentry.feedbackIntegration(),
  ],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

// =============================================================================
// SENTRY SETUP
// =============================================================================

// Initialize error reporting (does nothing if no DSN configured)
initSentry();

// =============================================================================
// NOTIFICATION SETUP
// =============================================================================

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Set up Android notification channel (required for Android 8+)
async function setupNotificationChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("challenge-notifications", {
      name: "Challenge Notifications",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#00D26A", // Electric Mint
    });
  }
}

// =============================================================================
// NOTIFICATION RESPONSE HANDLER (Deep Linking)
// =============================================================================

/**
 * Handle notification tap - navigate to relevant screen
 * Works for both foreground and background/killed state taps
 */
function useNotificationResponseHandler() {
  const router = useRouter();
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    // Handle notification taps
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;

        // Navigate based on notification type
        if (data?.challenge_id) {
          router.push(`/challenge/${data.challenge_id}`);
        } else if (data?.notification_type === "friend_request_received") {
          router.push("/(tabs)/friends");
        }
      });

    // Check if app was opened from a notification (killed state)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const data = response.notification.request.content.data;
        if (data?.challenge_id) {
          router.push(`/challenge/${data.challenge_id}`);
        } else if (data?.notification_type === "friend_request_received") {
          router.push("/(tabs)/friends");
        }
      }
    });

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [router]);
}

// =============================================================================
// CONFIGURATION ERROR SCREEN (Production)
// =============================================================================

/**
 * Displayed when Supabase configuration is missing.
 * In dev: app throws before reaching this (fail-fast).
 * In prod: renders this user-friendly screen.
 */
function ConfigurationErrorScreen() {
  return (
    <SafeAreaView style={configErrorStyles.container}>
      <View style={configErrorStyles.content}>
        <Text style={configErrorStyles.icon}>⚠️</Text>
        <Text style={configErrorStyles.title}>Configuration Error</Text>
        <Text style={configErrorStyles.message}>
          The app is not properly configured. Please contact support or try
          reinstalling the app.
        </Text>
        {__DEV__ && supabaseConfigError && (
          <View style={configErrorStyles.devInfo}>
            <Text style={configErrorStyles.devLabel}>Developer Info:</Text>
            <Text style={configErrorStyles.devMessage}>
              {supabaseConfigError}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const configErrorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F0F0F",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FAFAFA",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: "#A0A0A0",
    textAlign: "center",
    lineHeight: 24,
  },
  devInfo: {
    marginTop: 32,
    padding: 16,
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    width: "100%",
  },
  devLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FF6B6B",
    marginBottom: 8,
  },
  devMessage: {
    fontSize: 12,
    color: "#A0A0A0",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});

// Create a client
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

// Auth context to manage routing based on auth state
import type { Profile } from "@/types/database";

// Auth context to manage routing based on auth state
function useProtectedRoute(
  session: Session | null,
  isLoading: boolean,
  uiVersion: "v1" | "v2" | null,
  profile: Profile | null,
) {
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    // Wait for all required data to be ready
    if (isLoading || uiVersion === null) return;

    // CRITICAL: Wait for navigation state to be ready
    // This is the ROOT CAUSE fix - don't navigate until expo-router is fully initialized
    if (!navigationState?.key) {
      console.log("[useProtectedRoute] → Waiting for navigation to be ready");
      return;
    }

    const firstSegment = segments[0];

    // Determine where we are
    const inV1Auth = firstSegment === "(auth)";
    const inV2Auth = firstSegment === "(auth-v2)";
    const inAnyAuth = inV1Auth || inV2Auth;

    const inV1Tabs = firstSegment === "(tabs)";
    const inV2Tabs = firstSegment === "(tabs-v2)";

    // At root index (before any navigation has happened)
    const atRoot = !firstSegment;

    // Check if already in V2 onboarding (don't redirect away from it)
    const inV2Onboarding =
      firstSegment === "(auth-v2)" && segments[1] === "onboarding";

    // Determine targets based on UI version
    const targetAuth =
      uiVersion === "v2" ? "/(auth-v2)/welcome" : "/(auth)/login";
    const targetTabs = uiVersion === "v2" ? "/(tabs-v2)" : "/(tabs)";

    // Check if we're in the CORRECT place for our UI version
    const inCorrectAuth = uiVersion === "v2" ? inV2Auth : inV1Auth;
    const inCorrectTabs = uiVersion === "v2" ? inV2Tabs : inV1Tabs;

    // Check if we're in the WRONG version
    const inWrongAuth = uiVersion === "v2" ? inV1Auth : inV2Auth;
    const inWrongTabs = uiVersion === "v2" ? inV1Tabs : inV2Tabs;

    // V2 users need onboarding if health setup not completed
    const needsV2Onboarding =
      uiVersion === "v2" && profile && !profile.health_setup_completed_at;

    console.log("[useProtectedRoute] State:", {
      firstSegment,
      atRoot,
      inCorrectTabs,
      inWrongTabs,
      hasSession: !!session,
      needsV2Onboarding,
    });

    // =========================================================================
    // ROUTING LOGIC
    // =========================================================================

    if (!session) {
      // NOT LOGGED IN - should be in auth screens
      if (inCorrectAuth) {
        // Already in correct auth - do nothing
        return;
      }
      // Need to go to auth (from root, wrong auth, or tabs)
      console.log("[useProtectedRoute] → No session, redirecting to auth");
      router.replace(targetAuth);
      return;
    }

    // LOGGED IN from here

    // Already in correct tabs - do nothing
    if (inCorrectTabs) {
      console.log("[useProtectedRoute] → Already in correct tabs");
      return;
    }

    // In V2 onboarding - stay there
    if (inV2Onboarding) {
      console.log("[useProtectedRoute] → Staying in onboarding");
      return;
    }

    // At root or in wrong version - need to redirect
    if (atRoot || inWrongTabs || inAnyAuth) {
      // For V2: wait for profile to load before deciding destination
      if (uiVersion === "v2" && profile === null) {
        console.log("[useProtectedRoute] → Waiting for profile to load");
        return;
      }

      if (needsV2Onboarding) {
        console.log("[useProtectedRoute] → Redirecting to onboarding");
        router.replace("/(auth-v2)/onboarding");
      } else {
        console.log("[useProtectedRoute] → Redirecting to tabs:", targetTabs);
        router.replace(targetTabs);
      }
    }
  }, [
    session,
    segments,
    isLoading,
    uiVersion,
    profile,
    router,
    navigationState?.key,
  ]);
}

function RootLayoutNav() {
  const { colors, isDark } = useAppTheme();
  const { showToast } = useToast();
  // Use centralized auth state - NO MORE DUPLICATE SUBSCRIPTION
  const { session, loading: isLoading, profile, signOut } = useAuth();
  const { uiVersion, isLoading: flagsLoading } = useFeatureFlags();
  // Track if we've shown storage warning for this session
  const storageWarningShown = useRef(false);

  // GUARDRAIL 3: Network status monitoring
  const { isConnected } = useNetworkStatus();

  // GUARDRAIL 3: Offline queue state
  const processQueue = useOfflineStore((s) => s.processQueue);
  const queueLength = useOfflineStore((s) => s.queue.length);

  // BIOMETRIC LOCK: Security state
  const { biometricsEnabled, checkIfLocked, recordAuthentication } =
    useSecurityStore();
  const [showBiometricLock, setShowBiometricLock] = useState(false);
  const appState = useRef(AppState.currentState);

  // BIOMETRIC LOCK: Check on app foreground
  useEffect(() => {
    // Only apply biometric lock when user is logged in and biometrics enabled
    if (!session?.user?.id || !biometricsEnabled) {
      setShowBiometricLock(false);
      return;
    }

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // App coming to foreground from background/inactive
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        // Check if timeout has elapsed
        if (checkIfLocked()) {
          setShowBiometricLock(true);
        }
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    // Initial check on mount (e.g., app was killed and restarted)
    if (checkIfLocked()) {
      setShowBiometricLock(true);
    }

    return () => {
      subscription.remove();
    };
  }, [session?.user?.id, biometricsEnabled, checkIfLocked]);

  // BIOMETRIC LOCK: Handle successful unlock
  const handleBiometricUnlock = () => {
    recordAuthentication();
    setShowBiometricLock(false);
  };

  // BIOMETRIC LOCK: Handle "Use Password" (sign out and re-authenticate)
  const handleUsePassword = async () => {
    setShowBiometricLock(false);
    await signOut();
    // User will be redirected to auth screen by useProtectedRoute
  };

  useProtectedRoute(session, isLoading || flagsLoading, uiVersion, profile);

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

  // Check storage status and warn if degraded (once per login)
  useEffect(() => {
    // Only check when user logs in and we haven't shown warning yet
    if (!session?.user?.id || storageWarningShown.current) return;

    // Wait for storage probe to complete, then check status
    storageProbePromise.then((status) => {
      // Don't show warning if already shown or user logged out
      if (storageWarningShown.current) return;
      storageWarningShown.current = true;

      if (!status.isPersistent) {
        // Critical: session won't survive app restart
        showToast(
          "Session won't persist between app restarts. Storage unavailable.",
          "error",
          6000,
        );
      } else if (!status.isSecure) {
        // Warning: using unencrypted storage
        showToast(
          "Using unencrypted session storage. Your data is still safe.",
          "warning",
          5000,
        );
      }
      // If status.isSecure, no warning needed
    });
  }, [session?.user?.id, showToast]);

  // Reset warning flag when user logs out
  useEffect(() => {
    if (!session) {
      storageWarningShown.current = false;
    }
  }, [session]);

  // GUARDRAIL 1: Subscribe to mid-session storage degradation
  // This catches the case where SecureStore fails AFTER initial probe
  useEffect(() => {
    const unsubscribe = subscribeToStorageStatus((status) => {
      // Only show warning if degraded mid-session (has degradedAt timestamp)
      if (status.degradedAt) {
        if (!status.isPersistent) {
          showToast(
            "Storage failed. Session may not persist after app restart.",
            "error",
            0, // Don't auto-dismiss - user needs to see this
          );
        } else if (!status.isSecure) {
          showToast(
            "Switched to unencrypted storage. Your session is still safe.",
            "warning",
            6000,
          );
        }
      }
    });

    return unsubscribe;
  }, [showToast]);

  // GUARDRAIL 4: Enable realtime updates when logged in
  useRealtimeSubscription();

  // Set up notification channel on mount (Android only)
  useEffect(() => {
    setupNotificationChannel();
  }, []);

  // Handle notification taps for deep linking
  useNotificationResponseHandler();

  if (isLoading || flagsLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </View>
    );
  }

  // BIOMETRIC LOCK: Show lock screen when locked
  if (showBiometricLock) {
    return (
      <BiometricLockScreen
        onUnlock={handleBiometricUnlock}
        onUsePassword={handleUsePassword}
      />
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
          name="(auth-v2)"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="(tabs-v2)"
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
            title: "Challenge",
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
    </GestureHandlerRootView>
  );
}

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
