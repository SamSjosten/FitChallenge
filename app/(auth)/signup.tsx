// app/(auth)/signup.tsx
// Sign up screen - Design System v1.0

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
import { TestIDs } from "@/constants/testIDs";

export default function SignupScreen() {
  const { colors, spacing, radius, typography } = useAppTheme();
  const { signUp, loading, error, clearError } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSignUp = async () => {
    setLocalError(null);
    setFieldErrors({});
    clearError();

    const errors: Record<string, string> = {};

    if (!username.trim()) {
      errors.username = "Username is required";
    } else if (username.length < 3) {
      errors.username = "Username must be at least 3 characters";
    }

    if (!email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Please enter a valid email";
    }

    if (!password) {
      errors.password = "Password is required";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    } else if (!/[A-Z]/.test(password)) {
      errors.password = "Password must contain an uppercase letter";
    } else if (!/[a-z]/.test(password)) {
      errors.password = "Password must contain a lowercase letter";
    } else if (!/[0-9]/.test(password)) {
      errors.password = "Password must contain a number";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    try {
      await signUp(email, password, username);
      router.replace("/(tabs)");
    } catch (err: any) {
      setLocalError(err.message || "Sign up failed");
    }
  };

  const displayError = localError || error?.message;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      testID={TestIDs.screens.signup}
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
            Create Account
          </Text>
          <Text
            style={{
              fontSize: typography.fontSize.base,
              fontFamily: "PlusJakartaSans_500Medium",
              color: colors.textSecondary,
            }}
          >
            Start your fitness journey
          </Text>
        </View>

        <View style={{ marginBottom: spacing.xl }}>
          {/* Username */}
          <Text
            style={{
              fontSize: typography.fontSize.sm,
              fontFamily: "PlusJakartaSans_600SemiBold",
              color: colors.textSecondary,
              marginBottom: spacing.xs,
            }}
          >
            Username
          </Text>
          <TextInput
            testID={TestIDs.auth.usernameInput}
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.input,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
              borderWidth: 1,
              borderColor: fieldErrors.username ? colors.error : colors.border,
              fontSize: typography.fontSize.base,
              fontFamily: "PlusJakartaSans_500Medium",
              color: colors.textPrimary,
              marginBottom: fieldErrors.username ? spacing.xs : spacing.md,
            }}
            value={username}
            onChangeText={setUsername}
            placeholder="yourname"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {fieldErrors.username && (
            <Text
              testID={TestIDs.auth.usernameError}
              style={{
                fontSize: typography.fontSize.xs,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.error,
                marginBottom: spacing.md,
              }}
            >
              {fieldErrors.username}
            </Text>
          )}

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
            testID={TestIDs.auth.emailInput}
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.input,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
              borderWidth: 1,
              borderColor: fieldErrors.email ? colors.error : colors.border,
              fontSize: typography.fontSize.base,
              fontFamily: "PlusJakartaSans_500Medium",
              color: colors.textPrimary,
              marginBottom: fieldErrors.email ? spacing.xs : spacing.md,
            }}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {fieldErrors.email && (
            <Text
              testID={TestIDs.auth.emailError}
              style={{
                fontSize: typography.fontSize.xs,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.error,
                marginBottom: spacing.md,
              }}
            >
              {fieldErrors.email}
            </Text>
          )}

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
            testID={TestIDs.auth.passwordInput}
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.input,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
              borderWidth: 1,
              borderColor: fieldErrors.password ? colors.error : colors.border,
              fontSize: typography.fontSize.base,
              fontFamily: "PlusJakartaSans_500Medium",
              color: colors.textPrimary,
              marginBottom: spacing.xs,
            }}
            value={password}
            onChangeText={setPassword}
            placeholder="8+ chars, upper, lower, number"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
          />
          {/* Password requirements hint */}
          {!fieldErrors.password && (
            <Text
              style={{
                fontSize: typography.fontSize.xs,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.textMuted,
                marginBottom: spacing.md,
              }}
            >
              Must be 8+ characters with uppercase, lowercase, and number
            </Text>
          )}
          {fieldErrors.password && (
            <Text
              testID={TestIDs.auth.passwordError}
              style={{
                fontSize: typography.fontSize.xs,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.error,
                marginBottom: spacing.md,
              }}
            >
              {fieldErrors.password}
            </Text>
          )}

          {displayError && (
            <Text
              testID={TestIDs.auth.signupError}
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
            testID={TestIDs.auth.signUpButton}
            style={{
              backgroundColor: colors.primary.main,
              borderRadius: radius.button,
              paddingVertical: spacing.md,
              alignItems: "center",
              marginTop: spacing.sm,
              opacity: loading ? 0.7 : 1,
            }}
            onPress={handleSignUp}
            disabled={loading}
          >
            <Text
              style={{
                fontSize: typography.fontSize.base,
                fontFamily: "PlusJakartaSans_700Bold",
                color: "#FFFFFF",
              }}
            >
              {loading ? "Creating Account..." : "Create Account"}
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
            Already have an account?{" "}
          </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity testID={TestIDs.auth.signInLink}>
              <Text
                style={{
                  fontSize: typography.fontSize.sm,
                  fontFamily: "PlusJakartaSans_600SemiBold",
                  color: colors.primary.main,
                }}
              >
                Sign In
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
