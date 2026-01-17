// app/_layout.tsx
// Root layout with providers and auth routing

import React, { useEffect, useRef } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet, Platform, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { ThemeProvider, useAppTheme } from "@/providers/ThemeProvider";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { configValidation } from "@/constants/config";
import type { Session } from "@supabase/supabase-js";

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

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 3,
    },
  },
});

// Auth context to manage routing based on auth state
function useProtectedRoute(session: Session | null, isLoading: boolean) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      // Redirect to login if not signed in and not in auth group
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      // Redirect to home if signed in and in auth group
      router.replace("/(tabs)");
    }
  }, [session, segments, isLoading]);
}

function RootLayoutNav() {
  const { colors, isDark } = useAppTheme();
  // Use centralized auth state - NO MORE DUPLICATE SUBSCRIPTION
  const { session, loading: isLoading } = useAuth();

  useProtectedRoute(session, isLoading);

  // Enable realtime updates when logged in
  useRealtimeSubscription();

  // Set up notification channel on mount (Android only)
  useEffect(() => {
    setupNotificationChannel();
  }, []);

  // Handle notification taps for deep linking
  useNotificationResponseHandler();

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
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
        {/* Root redirect screen */}
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
          }}
        />
        {/* Auth screens */}
        <Stack.Screen
          name="(auth)/login"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="(auth)/signup"
          options={{
            headerShown: false,
          }}
        />
        {/* Main tabs */}
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
          }}
        />
        {/* Challenge screens */}
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
        {/* Notifications screen */}
        <Stack.Screen
          name="notifications"
          options={{
            title: "Notifications",
          }}
        />
        {/* Settings screen */}
        <Stack.Screen
          name="settings/index"
          options={{
            title: "Settings",
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  if (!configValidation.isValid && configValidation.message) {
    return (
      <SafeAreaProvider>
        <View style={styles.configError}>
          <Text style={styles.configErrorTitle}>Configuration Required</Text>
          <Text style={styles.configErrorBody}>{configValidation.message}</Text>
          <View style={styles.configErrorList}>
            {configValidation.missing.map((item) => (
              <Text key={item} style={styles.configErrorItem}>
                • {item}
              </Text>
            ))}
          </View>
          <Text style={styles.configErrorBody}>
            After updating your .env file, restart the Expo dev server.
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            <RootLayoutNav />
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  configError: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#0B0B0F",
  },
  configErrorTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  configErrorBody: {
    color: "#C9CDD4",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  configErrorList: {
    marginTop: 16,
    marginBottom: 16,
    alignSelf: "stretch",
  },
  configErrorItem: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
