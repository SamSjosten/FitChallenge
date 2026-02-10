// app/(auth)/auth.tsx
// V2 Auth screen — orchestration layer.
//
// Form state + Zod validation → useAuthForm hook
// Form fields → AuthFormField component
// Social buttons → SocialLoginButtons component
// Styles → auth.styles.ts
//
// This file owns: navigation locks, biometric auto-trigger,
// biometric setup modal, and screen layout.

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  InteractionManager,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/providers/AuthProvider";
import { BiometricSignInButton } from "@/components/BiometricSignInButton";
import { BiometricSetupModal } from "@/components/BiometricSetupModal";
import { AuthFormField, SocialLoginButtons } from "@/components/auth";
import { useNavigationStore } from "@/stores/navigationStore";
import { useAuthForm, type AuthMode } from "@/hooks/useAuthForm";
import {
  checkBiometricCapability,
  isBiometricSignInEnabled,
  performBiometricSignIn,
} from "@/lib/biometricSignIn";
import { styles } from "./auth.styles";

const LOG = "📱 [AuthScreen]";
const LOCK_TIMEOUT_MS = 10_000;

export default function AuthScreenV2() {
  const { signIn, signUp, signInWithApple, signInWithGoogle } = useAuth();
  const params = useLocalSearchParams<{ mode?: string }>();
  const insets = useSafeAreaInsets();

  const form = useAuthForm({ signIn, signUp }, (params.mode as AuthMode) || "signup");

  // ── Navigation Lock ───────────────────────────────────────────────────
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const setAuthHandlingNavigation = useNavigationStore((s) => s.setAuthHandlingNavigation);
  const lockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const acquireLock = useCallback(
    (source: string) => {
      if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
      setAuthHandlingNavigation(true);
      lockTimeoutRef.current = setTimeout(() => {
        if (isMounted.current) {
          setAuthHandlingNavigation(false);
          router.replace("/(tabs)");
        }
      }, LOCK_TIMEOUT_MS);
    },
    [setAuthHandlingNavigation],
  );

  const releaseLock = useCallback(
    (_source: string) => {
      if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
      lockTimeoutRef.current = null;
      setAuthHandlingNavigation(false);
    },
    [setAuthHandlingNavigation],
  );

  useEffect(() => {
    return () => {
      if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
    };
  }, []);

  // Sync mode from URL params
  useEffect(() => {
    if (params.mode === "signin" || params.mode === "signup") {
      form.switchMode(params.mode);
    }
  }, [params.mode]);

  // ── Biometric State ───────────────────────────────────────────────────
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const hasAutoTriggeredBiometric = useRef(false);
  const isReturningFromBlur = useRef(true);

  useEffect(() => {
    (async () => {
      const capability = await checkBiometricCapability();
      if (!isMounted.current) return;
      setBiometricAvailable(capability.isAvailable);
      if (capability.isAvailable) {
        const enabled = await isBiometricSignInEnabled();
        if (isMounted.current) setBiometricEnabled(enabled);
      }
    })();
  }, []);

  // ── Biometric Auto-Trigger on Focus ───────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (isReturningFromBlur.current) {
        hasAutoTriggeredBiometric.current = false;
        isReturningFromBlur.current = false;
      }
      if (form.mode !== "signin" || hasAutoTriggeredBiometric.current) {
        return () => {
          isReturningFromBlur.current = true;
        };
      }
      const task = InteractionManager.runAfterInteractions(async () => {
        if (hasAutoTriggeredBiometric.current || !isMounted.current) return;
        const enabled = await isBiometricSignInEnabled();
        if (!enabled || !isMounted.current) return;
        hasAutoTriggeredBiometric.current = true;
        handleAutoBiometricSignIn();
      });
      return () => {
        task.cancel();
        isReturningFromBlur.current = true;
      };
    }, [form.mode]),
  );

  // ── Biometric Handlers ────────────────────────────────────────────────
  const handleAutoBiometricSignIn = async () => {
    if (form.isLoading) return;
    acquireLock("autoBiometric");
    form.setIsLoading(true);
    try {
      const result = await performBiometricSignIn(signIn);
      if (!isMounted.current) {
        releaseLock("autoBiometric-unmount");
        return;
      }
      if (result.success) {
        router.replace("/(tabs)");
      } else {
        releaseLock("autoBiometric-fail");
        form.setIsLoading(false);
        if (!result.cancelled && result.error) form.setErrors({ general: result.error });
      }
    } catch (error: any) {
      if (isMounted.current) {
        releaseLock("autoBiometric-err");
        form.setIsLoading(false);
      }
    }
  };

  const handleBiometricSignInSuccess = () => {
    if (form.isLoading) return;
    acquireLock("biometricButton");
    form.setIsLoading(true);
    router.replace("/(tabs)");
  };

  const handleBiometricSetupComplete = (enabled: boolean) => {
    setShowBiometricSetup(false);
    setPendingCredentials(null);
    setBiometricEnabled(enabled);
    router.replace("/(tabs)");
  };

  const handleBiometricSetupDismiss = () => {
    setShowBiometricSetup(false);
    setPendingCredentials(null);
    router.replace("/(tabs)");
  };

  // ── Form Submit ───────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (form.isLoading) return;
    if (!form.validateForm()) return;
    acquireLock("submit");
    const result = await form.submitAuth();
    if (!result.success) {
      releaseLock("submit-err");
      Alert.alert("Error", result.error || "Authentication failed");
      return;
    }
    const shouldPromptBiometric =
      form.mode === "signin" ? biometricAvailable && !biometricEnabled : biometricAvailable;
    if (shouldPromptBiometric && result.credentials) {
      setPendingCredentials(result.credentials);
      setShowBiometricSetup(true);
      form.setIsLoading(false);
      return; // Lock stays held — modal handlers navigate
    }
    form.setIsLoading(false);
    router.replace("/(tabs)");
  };

  // ── Social Login ──────────────────────────────────────────────────────
  const handleSocialLogin = async (provider: "apple" | "google") => {
    if (form.isLoading) return;
    form.setIsLoading(true);
    form.setErrors({});
    try {
      if (provider === "apple") await signInWithApple();
      else await signInWithGoogle();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Sign-in failed";
      const cancelled = /cancel[le]d|ERR_REQUEST_CANCELED|SIGN_IN_CANCELLED/.test(msg);
      if (!cancelled) Alert.alert("Sign In Failed", msg);
    } finally {
      form.setIsLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Gradient Header */}
          <LinearGradient
            colors={["#34D399", "#10B981", "#0D9488"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.header, { paddingTop: insets.top + 16 }]}
          >
            <View style={styles.circleDecor1} />
            <View style={styles.circleDecor2} />
            <View style={styles.circleDecor3} />
            <View style={styles.circleDecor4} />
            <TouchableOpacity
              style={[styles.backButton, { top: insets.top + 8 }]}
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <View style={styles.iconContainer}>
                <Ionicons name="trophy" size={32} color="#10B981" />
              </View>
              <Text style={styles.headerTitle}>
                {form.mode === "signup" ? "Create Account" : "Welcome Back"}
              </Text>
              <Text style={styles.headerSubtitle}>
                {form.mode === "signup" ? "Join the fitness community" : "Sign in to continue"}
              </Text>
            </View>
          </LinearGradient>

          {/* Form Card */}
          <View style={styles.formCard}>
            {/* Mode Toggle */}
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeButton, form.mode === "signup" && styles.modeButtonActive]}
                onPress={() => form.switchMode("signup")}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    form.mode === "signup" && styles.modeButtonTextActive,
                  ]}
                >
                  Sign Up
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, form.mode === "signin" && styles.modeButtonActive]}
                onPress={() => form.switchMode("signin")}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    form.mode === "signin" && styles.modeButtonTextActive,
                  ]}
                >
                  Sign In
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            <View style={styles.formFields}>
              {form.errors.general && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={18} color="#DC2626" />
                  <Text style={styles.errorBannerText}>{form.errors.general}</Text>
                  <TouchableOpacity
                    onPress={form.clearGeneralError}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={18} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              )}
              {form.mode === "signup" && (
                <AuthFormField
                  icon="at"
                  placeholder="Username"
                  value={form.username}
                  onChangeText={form.handleUsernameChange}
                  error={form.errors.username}
                />
              )}
              <AuthFormField
                icon="mail-outline"
                placeholder="Email"
                value={form.email}
                onChangeText={form.setEmail}
                error={form.errors.email}
                keyboardType="email-address"
              />
              <AuthFormField
                icon="lock-closed-outline"
                placeholder="Password"
                value={form.password}
                onChangeText={form.setPassword}
                error={form.errors.password}
                secureTextEntry
                showPasswordToggle
                passwordVisible={form.showPassword}
                onTogglePassword={form.toggleShowPassword}
              />
              {form.mode === "signin" && (
                <View style={styles.rememberForgotRow}>
                  <View style={styles.rememberMeContainer}>
                    <Switch
                      value={form.rememberMe}
                      onValueChange={form.setRememberMe}
                      trackColor={{ false: "#E5E7EB", true: "#A7F3D0" }}
                      thumbColor={form.rememberMe ? "#10B981" : "#F9FAFB"}
                      ios_backgroundColor="#E5E7EB"
                      style={styles.rememberMeSwitch}
                    />
                    <Text style={styles.rememberMeText}>Remember me</Text>
                  </View>
                  <View style={styles.rightControls}>
                    <BiometricSignInButton
                      signIn={signIn}
                      onSignInSuccess={handleBiometricSignInSuccess}
                      onSetupRequired={() =>
                        Alert.alert(
                          "Set Up Face ID",
                          "Sign in with your password first to enable Face ID quick sign-in.",
                        )
                      }
                      onError={(msg) => Alert.alert("Sign In Failed", msg)}
                      disabled={form.isLoading}
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, form.isLoading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={form.isLoading}
            >
              {form.isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {form.mode === "signup" ? "Create Account" : "Sign In"}
                </Text>
              )}
            </TouchableOpacity>

            <SocialLoginButtons onSocialLogin={handleSocialLogin} disabled={form.isLoading} />

            {form.mode === "signup" && (
              <Text style={styles.termsText}>
                By signing up, you agree to our{" "}
                <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {pendingCredentials && (
        <BiometricSetupModal
          visible={showBiometricSetup}
          email={pendingCredentials.email}
          password={pendingCredentials.password}
          onComplete={handleBiometricSetupComplete}
          onDismiss={handleBiometricSetupDismiss}
        />
      )}
    </View>
  );
}
