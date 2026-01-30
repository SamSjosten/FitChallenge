// app/index.tsx
// Root index - shows loading while useProtectedRoute handles navigation
//
// This file does NOT navigate. The useProtectedRoute hook in _layout.tsx
// handles all navigation based on auth state. This prevents race conditions
// between multiple navigation attempts.

import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";

export default function Index() {
  const { colors } = useAppTheme();

  // Just show loading - useProtectedRoute will navigate us away
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary.main} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
