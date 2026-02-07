// src/components/shared/LoadingScreen.tsx
// Full-screen centered loading spinner (route-level loading)

import React from "react";
import { View, ActivityIndicator } from "react-native";
import { useTheme } from "@/constants/theme";

export function LoadingScreen() {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
      }}
    >
      <ActivityIndicator size="large" color={colors.primary.main} />
    </View>
  );
}
