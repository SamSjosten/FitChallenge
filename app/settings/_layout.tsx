// app/settings/_layout.tsx
import React from "react";
import { Stack } from "expo-router";

export default function SettingsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="health" options={{ headerShown: false }} />
      <Stack.Screen name="developer" options={{ title: "Developer Settings" }} />
    </Stack>
  );
}
