// src/components/ProfileErrorBoundary.tsx
// Handles profile loading failures gracefully with retry capability

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

interface ProfileErrorBoundaryProps {
  error: Error | null;
  isRetrying: boolean;
  onRetry: () => void;
  children: React.ReactNode;
}

/**
 * ProfileErrorBoundary
 *
 * Wraps authenticated app content and handles profile load failures.
 * Shows a retry screen instead of crashing or showing a blank screen.
 *
 * Usage:
 * ```
 * <ProfileErrorBoundary
 *   error={profileError}
 *   isRetrying={isRefreshing}
 *   onRetry={refreshProfile}
 * >
 *   <AppContent />
 * </ProfileErrorBoundary>
 * ```
 */
export function ProfileErrorBoundary({
  error,
  isRetrying,
  onRetry,
  children,
}: ProfileErrorBoundaryProps) {
  // No error - render children normally
  if (!error) {
    return <>{children}</>;
  }

  // Error state - show retry screen
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="cloud-offline-outline" size={64} color="#9CA3AF" />
        </View>

        <Text style={styles.title}>Couldn't Load Profile</Text>

        <Text style={styles.message}>
          {error.message.includes("timeout")
            ? "The request timed out. Please check your connection."
            : "Something went wrong loading your profile."}
        </Text>

        <TouchableOpacity
          style={[styles.retryButton, isRetrying && styles.retryButtonDisabled]}
          onPress={onRetry}
          disabled={isRetrying}
        >
          {isRetrying ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.hint}>
          If this keeps happening, try closing and reopening the app.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00D26A",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
    minWidth: 160,
  },
  retryButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  hint: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 24,
  },
});
