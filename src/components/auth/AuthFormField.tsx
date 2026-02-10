// src/components/auth/AuthFormField.tsx
// Reusable form field with icon, input, error display, and optional password toggle.
// Used for email, password, and username fields in the auth screen.

import React from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  type KeyboardTypeOptions,
  type TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface AuthFormFieldProps {
  /** Ionicons icon name displayed on the left */
  icon: keyof typeof Ionicons.glyphMap;
  /** Input placeholder text */
  placeholder: string;
  /** Current field value */
  value: string;
  /** Called when text changes */
  onChangeText: (text: string) => void;
  /** Validation error message (shown below field) */
  error?: string;
  /** Whether to obscure text entry (password fields) */
  secureTextEntry?: boolean;
  /** Show password visibility toggle button */
  showPasswordToggle?: boolean;
  /** Current password visibility state (used with showPasswordToggle) */
  passwordVisible?: boolean;
  /** Called when password toggle is pressed */
  onTogglePassword?: () => void;
  /** Keyboard type for the input */
  keyboardType?: KeyboardTypeOptions;
  /** Auto-capitalize behavior */
  autoCapitalize?: TextInputProps["autoCapitalize"];
  /** Auto-correct behavior (defaults to false) */
  autoCorrect?: boolean;
}

export function AuthFormField({
  icon,
  placeholder,
  value,
  onChangeText,
  error,
  secureTextEntry = false,
  showPasswordToggle = false,
  passwordVisible = false,
  onTogglePassword,
  keyboardType,
  autoCapitalize = "none",
  autoCorrect = false,
}: AuthFormFieldProps) {
  return (
    <View style={fieldStyles.wrapper}>
      <View style={[fieldStyles.container, error ? fieldStyles.containerError : undefined]}>
        <Ionicons name={icon} size={18} color="#9CA3AF" style={fieldStyles.icon} />
        <TextInput
          style={fieldStyles.input}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !passwordVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
        />
        {showPasswordToggle && onTogglePassword && (
          <TouchableOpacity onPress={onTogglePassword} style={fieldStyles.eyeButton}>
            <Ionicons
              name={passwordVisible ? "eye-off-outline" : "eye-outline"}
              size={18}
              color="#9CA3AF"
            />
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={fieldStyles.errorText}>{error}</Text> : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  containerError: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  icon: {
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
});
