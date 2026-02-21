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
//
// V2 Visual: Deep emerald gradient, AVVIO wordmark, orbital arcs,
// diamond ornament, PlusJakartaSans fonts, terms pinned to bottom.

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  Animated,
  Dimensions,
  Easing,
} from "react-native";
import Svg, { Path } from "react-native-svg";
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
import { TestIDs } from "@/constants/testIDs";

const LOG = "📱 [AuthScreen]";
const LOCK_TIMEOUT_MS = 10_000;

const SCREEN_W = Dimensions.get("window").width;

// =============================================================================
// DEEP EMERALD GRADIENT (matches welcome screen)
// =============================================================================

const AUTH_GRADIENT = {
  colors: ["#065F46", "#047857", "#0D9488", "#0F766E"] as const,
  locations: [0, 0.35, 0.65, 1] as const,
};

// =============================================================================
// ORBITAL ARCS (same seed as welcome, fewer arcs for smaller header)
// =============================================================================

interface ArcConfig {
  radius: number;
  startAngle: number;
  endAngle: number;
  strokeWidth: number;
  opacity: number;
  duration: number;
  direction: 1 | -1;
}

function seededRng(s: number) {
  let v = s;
  return () => {
    v = (v * 16807 + 0) % 2147483647;
    return (v & 0x7fffffff) / 0x7fffffff;
  };
}

function generateAuthArcs(): ArcConfig[] {
  const rng = seededRng(61);
  const arcs: ArcConfig[] = [];
  for (let i = 0; i < 20; i++) {
    const radius = 15 + i * 11 + (rng() - 0.5) * 3;
    if (radius > 140) break;
    const sweep = 0.3 + rng() * 2.8;
    const startAngle = rng() * Math.PI * 2 - Math.PI;
    arcs.push({
      radius,
      startAngle,
      endAngle: startAngle + sweep,
      strokeWidth: 0.3 + rng() * 1.2,
      opacity: 0.04 + rng() * 0.09,
      duration: (30 + rng() * 55) * 1000,
      direction: rng() > 0.5 ? 1 : -1,
    });
  }
  return arcs;
}

function buildArcPathData(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const steps = 40;
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = startAngle + (endAngle - startAngle) * t;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    points.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return points.join(" ");
}

function AuthOrbitalArcs({ headerHeight }: { headerHeight: number }) {
  const arcs = useMemo(() => generateAuthArcs(), []);
  const rotations = useRef(arcs.map(() => new Animated.Value(0))).current;

  const cx = SCREEN_W / 2;
  const cy = headerHeight / 2;

  useEffect(() => {
    const animations = arcs.map((arc: ArcConfig, i: number) =>
      Animated.loop(
        Animated.timing(rotations[i], {
          toValue: arc.direction,
          duration: arc.duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
    );
    animations.forEach((a: Animated.CompositeAnimation) => a.start());
    return () => animations.forEach((a: Animated.CompositeAnimation) => a.stop());
  }, []);

  return (
    <View style={styles.orbitalContainer} pointerEvents="none">
      {arcs.map((arc: ArcConfig, i: number) => {
        const rotation = rotations[i].interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "360deg"],
        });
        return (
          <Animated.View
            key={i}
            style={[
              styles.orbitalArcWrapper,
              { height: headerHeight, transform: [{ rotate: rotation }] },
            ]}
          >
            <Svg width={SCREEN_W} height={headerHeight}>
              <Path
                d={buildArcPathData(cx, cy, arc.radius, arc.startAngle, arc.endAngle)}
                stroke="#6EE7B7"
                strokeWidth={arc.strokeWidth}
                fill="none"
                opacity={arc.opacity}
                strokeLinecap="round"
              />
            </Svg>
          </Animated.View>
        );
      })}
    </View>
  );
}

// =============================================================================
// DIAMOND ORNAMENT (static version — no entrance animation)
// =============================================================================

function DiamondOrnament() {
  return (
    <View style={styles.ornamentContainer}>
      <View style={styles.ornamentLine} />
      <View style={styles.diamond} />
      <View style={styles.ornamentLine} />
    </View>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function AuthScreenV2() {
  const { signIn, signUp, signInWithApple, signInWithGoogle } = useAuth();
  const params = useLocalSearchParams<{ mode?: string }>();
  const insets = useSafeAreaInsets();

  const form = useAuthForm({ signIn, signUp }, (params.mode as AuthMode) || "signup");

  // Header height for orbital arc centering
  // paddingTop (insets + 16) + content (~90) + paddingBottom (72) ≈ dynamic
  const headerHeight = insets.top + 16 + 90 + 72;

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
    <View testID={TestIDs.screens.login} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* ═══ Deep Emerald Header ═══ */}
          <LinearGradient
            colors={[...AUTH_GRADIENT.colors]}
            locations={[...AUTH_GRADIENT.locations]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.3, y: 1 }}
            style={[styles.header, { paddingTop: insets.top + 16 }]}
          >
            <AuthOrbitalArcs headerHeight={headerHeight} />

            <TouchableOpacity
              style={[styles.backButton, { top: insets.top + 8 }]}
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>

            <View style={styles.headerContent}>
              <Text style={styles.avvioTitle}>AVVIO</Text>
              <DiamondOrnament />
              <Text style={styles.headerSubtitle}>
                {form.mode === "signup" ? "Join the fitness community" : "Sign in to continue"}
              </Text>
            </View>
          </LinearGradient>

          {/* ═══ Form Card ═══ */}
          <View style={styles.formCard}>
            {/* Mode Toggle */}
            <View style={styles.modeToggle}>
              <TouchableOpacity
                testID={TestIDs.auth.signupModeButton}
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
                testID={TestIDs.auth.signinModeButton}
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
                <View testID={TestIDs.auth.loginError} style={styles.errorBanner}>
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
                  testID={TestIDs.auth.usernameInput}
                  icon="at"
                  placeholder="Username"
                  value={form.username}
                  onChangeText={form.handleUsernameChange}
                  error={form.errors.username}
                />
              )}
              <AuthFormField
                testID={TestIDs.auth.emailInput}
                icon="mail-outline"
                placeholder="Email"
                value={form.email}
                onChangeText={form.setEmail}
                error={form.errors.email}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
              />
              <AuthFormField
                testID={TestIDs.auth.passwordInput}
                icon="lock-closed-outline"
                placeholder="Password"
                value={form.password}
                onChangeText={form.setPassword}
                error={form.errors.password}
                secureTextEntry
                showPasswordToggle
                passwordVisible={form.showPassword}
                onTogglePassword={form.toggleShowPassword}
                textContentType="password"
                autoComplete="password"
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
              testID={
                form.mode === "signup" ? TestIDs.auth.signUpButton : TestIDs.auth.signInButton
              }
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

            {/* Spacer pushes terms to bottom */}
            <View style={styles.termsSpacer} />

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
