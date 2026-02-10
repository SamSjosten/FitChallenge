// src/components/ConfigurationError.tsx
// Error screen shown when Supabase env vars are missing
//
// Extracted from app/_layout.tsx (Phase 3 refactor)
// No logic changes — identical to the inline version.

import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabaseConfigError } from "@/lib/supabase";

/**
 * Displayed when Supabase configuration is missing.
 * In dev: shows technical details for debugging.
 * In prod: shows user-friendly message.
 */
export function ConfigurationErrorScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.title}>Configuration Error</Text>
        <Text style={styles.message}>
          The app is not properly configured. Please contact support or try reinstalling the app.
        </Text>
        {__DEV__ && supabaseConfigError && (
          <View style={styles.devInfo}>
            <Text style={styles.devLabel}>Developer Info:</Text>
            <Text style={styles.devMessage}>{supabaseConfigError}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
