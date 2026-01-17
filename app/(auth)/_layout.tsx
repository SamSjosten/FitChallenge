import React from "react";
import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: "#0B0B0F",
        },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
