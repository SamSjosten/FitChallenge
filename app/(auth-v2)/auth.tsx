// app/(auth-v2)/auth.tsx
// V2 Auth screen - matches mock design with gradient header, mode toggle, social login

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import { BiometricSignInButton } from "@/components/BiometricSignInButton";
import { BiometricSetupModal } from "@/components/BiometricSetupModal";
import {
  checkBiometricCapability,
  isBiometricSignInEnabled,
} from "@/lib/biometricSignIn";

type AuthMode = "signup" | "signin";

export default function AuthScreenV2() {
  const { colors, spacing, radius } = useAppTheme();
  const { signIn, signUp } = useAuth();
  const params = useLocalSearchParams<{ mode?: string }>();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<AuthMode>(
    (params.mode as AuthMode) || "signup",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rememberMe, setRememberMe] = useState(false);
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);

  const REMEMBER_EMAIL_KEY = "fitchallenge_remembered_email";

  // Load saved email on mount
  useEffect(() => {
    const loadSavedEmail = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem(REMEMBER_EMAIL_KEY);
        if (savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
        }
      } catch (error) {
        console.error("Failed to load saved email:", error);
      }
    };
    loadSavedEmail();
  }, []);

  // Check biometric availability on mount
  useEffect(() => {
    const checkBiometrics = async () => {
      const capability = await checkBiometricCapability();
      setBiometricAvailable(capability.isAvailable);

      if (capability.isAvailable) {
        const enabled = await isBiometricSignInEnabled();
        setBiometricEnabled(enabled);
      }
    };
    checkBiometrics();
  }, []);

  useEffect(() => {
    if (params.mode === "signin" || params.mode === "signup") {
      setMode(params.mode);
    }
  }, [params.mode]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Invalid email format";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    if (mode === "signup" && !username) {
      newErrors.username = "Username is required";
    } else if (mode === "signup" && username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
        // Save or clear remembered email
        if (rememberMe) {
          await AsyncStorage.setItem(REMEMBER_EMAIL_KEY, email);
        } else {
          await AsyncStorage.removeItem(REMEMBER_EMAIL_KEY);
        }

        // Check if we should show biometric setup prompt
        if (biometricAvailable && !biometricEnabled) {
          // Store credentials temporarily for setup
          setPendingCredentials({ email, password });
          setShowBiometricSetup(true);
          setIsLoading(false);
          // Don't navigate yet - wait for modal dismissal
          return;
        }
        // Navigation handled by useProtectedRoute in _layout.tsx
      } else {
        await signUp(email, password, username);
      }
      // Navigation handled by useProtectedRoute in _layout.tsx
    } catch (error: any) {
      Alert.alert("Error", error.message || "Authentication failed");
      setIsLoading(false);
    }
  };

  // Handle biometric setup completion
  const handleBiometricSetupComplete = (enabled: boolean) => {
    setShowBiometricSetup(false);
    setPendingCredentials(null);
    setBiometricEnabled(enabled);
    // Navigation will happen automatically via useProtectedRoute
  };

  // Handle biometric setup dismissal
  const handleBiometricSetupDismiss = () => {
    setShowBiometricSetup(false);
    setPendingCredentials(null);
    // Navigation will happen automatically via useProtectedRoute
  };

  // Handle biometric sign-in success
  const handleBiometricSignInSuccess = () => {
    // Navigation handled by useProtectedRoute in _layout.tsx
  };

  // Handle biometric setup required (user tapped button but not set up)
  const handleBiometricSetupRequired = () => {
    Alert.alert(
      "Set Up Face ID",
      "Sign in with your password first to enable Face ID quick sign-in.",
      [{ text: "OK" }],
    );
  };

  // Handle biometric error
  const handleBiometricError = (message: string) => {
    Alert.alert("Sign In Failed", message);
  };

  const handleSocialLogin = async (provider: "apple" | "google") => {
    Alert.alert("Coming Soon", `${provider} sign-in will be available soon!`);
  };

  const handleUsernameChange = (text: string) => {
    // Only allow lowercase letters, numbers, and underscores
    const sanitized = text.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setUsername(sanitized);
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setErrors({});
  };

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
            {/* Background circles decoration */}
            <View style={styles.circleDecor1} />
            <View style={styles.circleDecor2} />
            <View style={styles.circleDecor3} />
            <View style={styles.circleDecor4} />

            {/* Back Button */}
            <TouchableOpacity
              style={[styles.backButton, { top: insets.top + 8 }]}
              onPress={() => router.back()}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color="rgba(255,255,255,0.8)"
              />
            </TouchableOpacity>

            {/* Header Content */}
            <View style={styles.headerContent}>
              <View style={styles.iconContainer}>
                <Ionicons name="trophy" size={32} color="#10B981" />
              </View>
              <Text style={styles.headerTitle}>
                {mode === "signup" ? "Create Account" : "Welcome Back"}
              </Text>
              <Text style={styles.headerSubtitle}>
                {mode === "signup"
                  ? "Join the fitness community"
                  : "Sign in to continue"}
              </Text>
            </View>
          </LinearGradient>

          {/* Form Card */}
          <View style={styles.formCard}>
            {/* Mode Toggle */}
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  mode === "signup" && styles.modeButtonActive,
                ]}
                onPress={() => switchMode("signup")}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    mode === "signup" && styles.modeButtonTextActive,
                  ]}
                >
                  Sign Up
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  mode === "signin" && styles.modeButtonActive,
                ]}
                onPress={() => switchMode("signin")}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    mode === "signin" && styles.modeButtonTextActive,
                  ]}
                >
                  Sign In
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            <View style={styles.formFields}>
              {/* Username (Sign Up only) */}
              {mode === "signup" && (
                <View style={styles.inputWrapper}>
                  <View
                    style={[
                      styles.inputContainer,
                      errors.username && styles.inputError,
                    ]}
                  >
                    <Ionicons
                      name="at"
                      size={18}
                      color="#9CA3AF"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Username"
                      placeholderTextColor="#9CA3AF"
                      value={username}
                      onChangeText={handleUsernameChange}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  {errors.username && (
                    <Text style={styles.errorText}>{errors.username}</Text>
                  )}
                </View>
              )}

              {/* Email */}
              <View style={styles.inputWrapper}>
                <View
                  style={[
                    styles.inputContainer,
                    errors.email && styles.inputError,
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={18}
                    color="#9CA3AF"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="#9CA3AF"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {errors.email && (
                  <Text style={styles.errorText}>{errors.email}</Text>
                )}
              </View>

              {/* Password */}
              <View style={styles.inputWrapper}>
                <View
                  style={[
                    styles.inputContainer,
                    errors.password && styles.inputError,
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color="#9CA3AF"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#9CA3AF"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                </View>
                {errors.password && (
                  <Text style={styles.errorText}>{errors.password}</Text>
                )}
              </View>

              {/* Forgot Password (Sign In only) */}
              {mode === "signin" && (
                <View style={styles.rememberForgotRow}>
                  {/* Remember Me Toggle */}
                  <View style={styles.rememberMeContainer}>
                    <Switch
                      value={rememberMe}
                      onValueChange={setRememberMe}
                      trackColor={{ false: "#E5E7EB", true: "#A7F3D0" }}
                      thumbColor={rememberMe ? "#10B981" : "#F9FAFB"}
                      ios_backgroundColor="#E5E7EB"
                      style={styles.rememberMeSwitch}
                    />
                    <Text style={styles.rememberMeText}>Remember me</Text>
                  </View>

                  {/* Face ID Button */}
                  <View style={styles.rightControls}>
                    <BiometricSignInButton
                      onSignInSuccess={handleBiometricSignInSuccess}
                      onSetupRequired={handleBiometricSetupRequired}
                      onError={handleBiometricError}
                      disabled={isLoading}
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                isLoading && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {mode === "signup" ? "Create Account" : "Sign In"}
                </Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Login */}
            <View style={styles.socialButtons}>
              <TouchableOpacity
                style={styles.appleButton}
                onPress={() => handleSocialLogin("apple")}
                disabled={isLoading}
              >
                <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
                <Text style={styles.appleButtonText}>Apple</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.googleButton}
                onPress={() => handleSocialLogin("google")}
                disabled={isLoading}
              >
                <Ionicons name="logo-google" size={20} color="#374151" />
                <Text style={styles.googleButtonText}>Google</Text>
              </TouchableOpacity>
            </View>

            {/* Terms (Sign Up only) */}
            {mode === "signup" && (
              <Text style={styles.termsText}>
                By signing up, you agree to our{" "}
                <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Biometric Setup Modal */}
      <BiometricSetupModal
        visible={showBiometricSetup}
        email={pendingCredentials?.email || ""}
        password={pendingCredentials?.password || ""}
        onComplete={handleBiometricSetupComplete}
        onDismiss={handleBiometricSetupDismiss}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
  },

  // Header
  header: {
    paddingBottom: 100,
    paddingHorizontal: 24,
    position: "relative",
    overflow: "hidden",
  },
  circleDecor1: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.1)",
    left: "10%",
    top: "20%",
  },
  circleDecor2: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.1)",
    left: "70%",
    top: "20%",
  },
  circleDecor3: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.1)",
    left: "10%",
    top: "70%",
  },
  circleDecor4: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.1)",
    left: "70%",
    top: "70%",
  },
  backButton: {
    position: "absolute",
    left: 16,
    padding: 8,
    zIndex: 10,
  },
  headerContent: {
    alignItems: "center",
    marginTop: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(236, 253, 245, 0.9)",
  },

  // Form Card
  formCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -32,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },

  // Mode Toggle
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  modeButtonActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  modeButtonTextActive: {
    color: "#111827",
  },

  // Form Fields
  formFields: {
    marginBottom: 24,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  inputError: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: "#111827",
  },
  eyeButton: {
    padding: 4,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  rememberForgotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  rememberMeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  rememberMeSwitch: {
    transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
    marginRight: 4,
  },
  rememberMeText: {
    fontSize: 14,
    color: "#6B7280",
  },
  rightControls: {
    flexDirection: "row",
    alignItems: "center",
  },

  // Submit Button
  submitButton: {
    backgroundColor: "#10B981",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },

  // Divider
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  dividerText: {
    color: "#9CA3AF",
    fontSize: 14,
    marginHorizontal: 16,
  },

  // Social Buttons
  socialButtons: {
    flexDirection: "row",
    gap: 12,
  },
  appleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  appleButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
  },
  googleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  googleButtonText: {
    color: "#374151",
    fontSize: 16,
    fontWeight: "500",
  },

  // Terms
  termsText: {
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 24,
    lineHeight: 18,
  },
  termsLink: {
    color: "#059669",
  },
});
