// app/(auth)/login.tsx
// Sign in screen - Design System v1.0

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
} from "react-native";
import { Link, router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/hooks/useAuth";
import { useAppTheme } from "@/providers/ThemeProvider";
import { TestIDs } from "@/constants/testIDs";
import { BiometricSignInButton } from "@/components/BiometricSignInButton";
import { BiometricSetupModal } from "@/components/BiometricSetupModal";
import {
  checkBiometricCapability,
  isBiometricSignInEnabled,
} from "@/lib/biometricSignIn";

const REMEMBER_EMAIL_KEY = "fitchallenge_remembered_email";

export default function LoginScreen() {
  const { colors, spacing, radius, typography } = useAppTheme();
  const { signIn, loading, error, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);

  // Load saved email and check biometrics on mount
  useEffect(() => {
    const init = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem(REMEMBER_EMAIL_KEY);
        if (savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
        }
      } catch (error) {
        console.error("Failed to load saved email:", error);
      }

      const capability = await checkBiometricCapability();
      setBiometricAvailable(capability.isAvailable);

      if (capability.isAvailable) {
        const enabled = await isBiometricSignInEnabled();
        setBiometricEnabled(enabled);
      }
    };
    init();
  }, []);

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

      // Save or clear remembered email
      if (rememberMe) {
        await AsyncStorage.setItem(REMEMBER_EMAIL_KEY, email);
      } else {
        await AsyncStorage.removeItem(REMEMBER_EMAIL_KEY);
      }

      // Check if we should show biometric setup prompt
      if (biometricAvailable && !biometricEnabled) {
        setPendingCredentials({ email, password });
        setShowBiometricSetup(true);
        return;
      }

      router.replace("/(tabs)");
    } catch (err: any) {
      setLocalError(err.message || "Sign in failed");
    }
  };

  // Handle biometric setup completion
  const handleBiometricSetupComplete = (enabled: boolean) => {
    setShowBiometricSetup(false);
    setPendingCredentials(null);
    setBiometricEnabled(enabled);
    router.replace("/(tabs)");
  };

  // Handle biometric setup dismissal
  const handleBiometricSetupDismiss = () => {
    setShowBiometricSetup(false);
    setPendingCredentials(null);
    router.replace("/(tabs)");
  };

  // Handle biometric sign-in success
  const handleBiometricSignInSuccess = () => {
    router.replace("/(tabs)");
  };

  // Handle biometric setup required
  const handleBiometricSetupRequired = () => {
    Alert.alert(
      "Set Up Face ID",
      "Sign in with your password first to enable Face ID quick sign-in.",
      [{ text: "OK" }],
    );
  };

  // Handle biometric error
  const handleBiometricError = (message: string) => {
    setLocalError(message);
  };

  const displayError = localError || error?.message;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      testID={TestIDs.screens.login}
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
            testID={TestIDs.auth.emailInput}
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
            testID={TestIDs.auth.passwordInput}
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

          {/* Remember Me & Face ID Row */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: spacing.md,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Switch
                value={rememberMe}
                onValueChange={setRememberMe}
                trackColor={{
                  false: colors.border,
                  true: colors.primary.light,
                }}
                thumbColor={rememberMe ? colors.primary.main : colors.surface}
                style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
              />
              <Text
                style={{
                  fontSize: typography.fontSize.sm,
                  fontFamily: "PlusJakartaSans_500Medium",
                  color: colors.textSecondary,
                  marginLeft: spacing.xs,
                }}
              >
                Remember me
              </Text>
            </View>

            {/* Face ID Button */}
            <BiometricSignInButton
              onSignInSuccess={handleBiometricSignInSuccess}
              onSetupRequired={handleBiometricSetupRequired}
              onError={handleBiometricError}
              disabled={loading}
            />
          </View>

          {displayError && (
            <Text
              testID={TestIDs.auth.loginError}
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
            testID={TestIDs.auth.signInButton}
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
            <TouchableOpacity testID={TestIDs.auth.signUpLink}>
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

      {/* Biometric Setup Modal */}
      <BiometricSetupModal
        visible={showBiometricSetup}
        email={pendingCredentials?.email || ""}
        password={pendingCredentials?.password || ""}
        onComplete={handleBiometricSetupComplete}
        onDismiss={handleBiometricSetupDismiss}
      />
    </KeyboardAvoidingView>
  );
}
