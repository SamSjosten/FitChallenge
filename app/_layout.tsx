// app/_layout.tsx
// Root layout with providers and auth routing

import React, { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import {
  View,
  ActivityIndicator,
  StyleSheet,
  useColorScheme,
} from "react-native";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { syncServerTime } from "@/lib/serverTime";
import { ThemeProvider, useAppTheme } from "@/providers/ThemeProvider";

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
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);

      // Sync server time once authenticated
      if (session) {
        syncServerTime().catch((err) =>
          console.warn("Initial server time sync failed:", err)
        );
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);

      // Re-sync server time on auth state change (e.g., fresh login)
      if (session) {
        syncServerTime().catch((err) =>
          console.warn("Server time sync on auth change failed:", err)
        );
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useProtectedRoute(session, isLoading);

  // Enable realtime updates when logged in
  useRealtimeSubscription();

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
        <Stack.Screen
          name="(auth)/login"
          options={{
            title: "Sign In",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="(auth)/signup"
          options={{
            title: "Sign Up",
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
            title: "Challenge",
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RootLayoutNav />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
