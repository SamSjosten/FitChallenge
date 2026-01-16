// app/_layout.tsx
// Root layout with providers and auth routing

import React, { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { ThemeProvider, useAppTheme } from "@/providers/ThemeProvider";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import type { Session } from "@supabase/supabase-js";

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
      <AuthProvider>
        <ThemeProvider>
          <RootLayoutNav />
        </ThemeProvider>
      </AuthProvider>
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
