// app/(auth)/login.tsx
// Sign in screen - Design System v1.0

import React, { useState } from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { Link, router } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { useAppTheme } from "@/providers/ThemeProvider";

export default function LoginScreen() {
  const { colors, spacing, radius, typography } = useAppTheme();
  const { signIn, loading, error, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setLocalError(null);
    clearError();

    if (!email.trim()) {
      setLocalError("Email is required");
      return;
    }
    if (!password) {
      setLocalError("Password is required");
      return;
    }

    try {
      await signIn(email, password);
      router.replace("/(tabs)");
    } catch (err: any) {
      setLocalError(err.message || "Sign in failed");
    }
  };

  const displayError = localError || error?.message;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: spacing.xl }}>
          <Text
            style={{
              fontSize: typography.fontSize["2xl"],
              fontFamily: "PlusJakartaSans_700Bold",
              color: colors.textPrimary,
              marginBottom: spacing.sm,
            }}
          >
            Welcome Back
          </Text>
          <Text
            style={{
              fontSize: typography.fontSize.base,
              fontFamily: "PlusJakartaSans_500Medium",
              color: colors.textSecondary,
            }}
          >
            Sign in to continue
          </Text>
        </View>

        <View style={{ marginBottom: spacing.xl }}>
          {/* Email */}
          <Text
            style={{
              fontSize: typography.fontSize.sm,
              fontFamily: "PlusJakartaSans_600SemiBold",
              color: colors.textSecondary,
              marginBottom: spacing.xs,
            }}
          >
            Email
          </Text>
          <TextInput
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.input,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
              fontSize: typography.fontSize.base,
              fontFamily: "PlusJakartaSans_500Medium",
              color: colors.textPrimary,
              marginBottom: spacing.md,
            }}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Password */}
          <Text
            style={{
              fontSize: typography.fontSize.sm,
              fontFamily: "PlusJakartaSans_600SemiBold",
              color: colors.textSecondary,
              marginBottom: spacing.xs,
            }}
          >
            Password
          </Text>
          <TextInput
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.input,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
              fontSize: typography.fontSize.base,
              fontFamily: "PlusJakartaSans_500Medium",
              color: colors.textPrimary,
              marginBottom: spacing.md,
            }}
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
          />

          {displayError && (
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.error,
                textAlign: "center",
                marginBottom: spacing.md,
              }}
            >
              {displayError}
            </Text>
          )}

          <TouchableOpacity
            style={{
              backgroundColor: colors.primary.main,
              borderRadius: radius.button,
              paddingVertical: spacing.md,
              alignItems: "center",
              marginTop: spacing.sm,
              opacity: loading ? 0.7 : 1,
            }}
            onPress={handleSignIn}
            disabled={loading}
          >
            <Text
              style={{
                fontSize: typography.fontSize.base,
                fontFamily: "PlusJakartaSans_700Bold",
                color: "#FFFFFF",
              }}
            >
              {loading ? "Signing In..." : "Sign In"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "center" }}>
          <Text
            style={{
              fontSize: typography.fontSize.sm,
              fontFamily: "PlusJakartaSans_500Medium",
              color: colors.textSecondary,
            }}
          >
            Don't have an account?{" "}
          </Text>
          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity>
              <Text
                style={{
                  fontSize: typography.fontSize.sm,
                  fontFamily: "PlusJakartaSans_600SemiBold",
                  color: colors.primary.main,
                }}
              >
                Sign Up
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
