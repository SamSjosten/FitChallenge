// src/components/shared/ErrorState.tsx
// Error display states
//
// Variants:
// - generic: General error with retry option
// - network: Network connectivity error
// - server: Server/API error
// - not-found: Resource not found

import React from "react";
import { View, Text, StyleSheet, Pressable, ViewStyle } from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import {
  ExclamationTriangleIcon,
  WifiIcon,
  ServerIcon,
  ArrowPathIcon,
} from "react-native-heroicons/outline";

// =============================================================================
// TYPES
// =============================================================================

export type ErrorVariant = "generic" | "network" | "server" | "not-found";

export interface ErrorStateProps {
  variant?: ErrorVariant;
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  onBack?: () => void;
  backLabel?: string;
  fullScreen?: boolean;
  style?: ViewStyle;
  testID?: string;
}

// =============================================================================
// VARIANT CONFIGS
// =============================================================================

interface VariantConfig {
  icon: React.ComponentType<{ size: number; color: string }>;
  defaultTitle: string;
  defaultMessage: string;
}

const variantConfigs: Record<ErrorVariant, VariantConfig> = {
  generic: {
    icon: ExclamationTriangleIcon,
    defaultTitle: "Something went wrong",
    defaultMessage: "An unexpected error occurred. Please try again.",
  },
  network: {
    icon: WifiIcon,
    defaultTitle: "No connection",
    defaultMessage: "Please check your internet connection and try again.",
  },
  server: {
    icon: ServerIcon,
    defaultTitle: "Server error",
    defaultMessage: "We're having trouble connecting to our servers. Please try again later.",
  },
  "not-found": {
    icon: ExclamationTriangleIcon,
    defaultTitle: "Not found",
    defaultMessage: "The content you're looking for doesn't exist or has been removed.",
  },
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ErrorState({
  variant = "generic",
  title,
  message,
  onRetry,
  retryLabel = "Try again",
  onBack,
  backLabel = "Go Back",
  fullScreen = true,
  style,
  testID = "error-state",
}: ErrorStateProps) {
  const { colors, shadows } = useAppTheme();
  const config = variantConfigs[variant];
  const IconComponent = config.icon;

  const content = (
    <View
      style={[
        styles.container,
        fullScreen && styles.fullScreen,
        { backgroundColor: fullScreen ? colors.background : "transparent" },
        style,
      ]}
      testID={testID}
    >
      <View style={[styles.iconContainer, { backgroundColor: colors.error + "15" }]}>
        <IconComponent size={32} color={colors.error} />
      </View>

      <Text style={[styles.title, { color: colors.textPrimary }]} testID={`${testID}-title`}>
        {title || config.defaultTitle}
      </Text>

      <Text style={[styles.message, { color: colors.textSecondary }]} testID={`${testID}-message`}>
        {message || config.defaultMessage}
      </Text>

      {onRetry && (
        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            {
              backgroundColor: colors.primary.main,
              opacity: pressed ? 0.8 : 1,
              ...shadows.button,
            },
          ]}
          onPress={onRetry}
          testID={`${testID}-retry`}
        >
          <ArrowPathIcon size={18} color={colors.primary.contrast} />
          <Text style={[styles.retryText, { color: colors.primary.contrast }]}>{retryLabel}</Text>
        </Pressable>
      )}

      {onBack && (
        <Pressable
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.6 : 1 }]}
          onPress={onBack}
          testID={`${testID}-back`}
        >
          <Text style={[styles.backText, { color: colors.textSecondary }]}>{backLabel}</Text>
        </Pressable>
      )}
    </View>
  );

  return content;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  fullScreen: {
    flex: 1,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: "PlusJakartaSans_700Bold",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_400Regular",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  retryText: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  backButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  backText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_500Medium",
  },
});

export default ErrorState;
