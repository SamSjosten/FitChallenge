// app/(auth)/_layout.tsx
// Auth group layout for login and signup screens

import { Stack } from "expo-router";
import { useAppTheme } from "@/providers/ThemeProvider";

export default function AuthLayout() {
  const { colors } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
