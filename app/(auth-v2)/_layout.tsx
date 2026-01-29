// app/(auth-v2)/_layout.tsx
// V2 Auth flow layout - handles welcome, auth, and onboarding screens

import { Stack } from "expo-router";
import { useAppTheme } from "@/providers/ThemeProvider";

export default function AuthLayoutV2() {
  const { colors } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
