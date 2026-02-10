// src/components/auth/SocialLoginButtons.tsx
// Social login section with divider, Apple Sign-In, and Google Sign-In buttons.

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface SocialLoginButtonsProps {
  /** Called when a social login button is pressed */
  onSocialLogin: (provider: "apple" | "google") => void;
  /** Disable buttons during other operations */
  disabled?: boolean;
}

export function SocialLoginButtons({ onSocialLogin, disabled = false }: SocialLoginButtonsProps) {
  return (
    <>
      {/* Divider */}
      <View style={socialStyles.divider}>
        <View style={socialStyles.dividerLine} />
        <Text style={socialStyles.dividerText}>or continue with</Text>
        <View style={socialStyles.dividerLine} />
      </View>

      {/* Social Buttons */}
      <View style={socialStyles.buttons}>
        <TouchableOpacity
          style={socialStyles.appleButton}
          onPress={() => onSocialLogin("apple")}
          disabled={disabled}
        >
          <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
          <Text style={socialStyles.appleButtonText}>Apple</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={socialStyles.googleButton}
          onPress={() => onSocialLogin("google")}
          disabled={disabled}
        >
          <Ionicons name="logo-google" size={20} color="#374151" />
          <Text style={socialStyles.googleButtonText}>Google</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const socialStyles = StyleSheet.create({
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
  buttons: {
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
});
