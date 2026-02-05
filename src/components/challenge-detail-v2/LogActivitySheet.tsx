// src/components/challenge-detail-v2/LogActivitySheet.tsx
//
// CONTRACTS ENFORCED:
// - Owns its own input state — parent doesn't manage activityValue string
// - Calls onSubmit with a validated number, not a string
// - Uses parseInt with radix parameter (fixes Q4)

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import { TestIDs } from "@/constants/testIDs";
import type { LogActivitySheetProps } from "./types";

export function LogActivitySheet({
  visible,
  onClose,
  onSubmit,
  isLoading,
  goalUnit,
  challengeType,
}: LogActivitySheetProps) {
  const { colors, spacing, radius, typography } = useAppTheme();
  const [value, setValue] = useState("");

  // Reset input when sheet closes
  useEffect(() => {
    if (!visible) {
      setValue("");
    }
  }, [visible]);

  if (!visible) return null;

  const handleSubmit = () => {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert("Invalid Value", "Please enter a positive number");
      return;
    }
    onSubmit(parsed);
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Backdrop */}
      <TouchableOpacity
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.4)",
        }}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Sheet */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "flex-end" }}
      >
        <View
          testID={TestIDs.logActivity.modal}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: spacing.md,
            paddingBottom: spacing.xl + 16,
          }}
        >
          {/* Handle */}
          <View
            style={{
              width: 36,
              height: 4,
              backgroundColor: colors.border,
              borderRadius: 2,
              alignSelf: "center",
              marginBottom: spacing.md,
            }}
          />

          <Text
            style={{
              fontSize: typography.fontSize.lg,
              fontFamily: "PlusJakartaSans_700Bold",
              color: colors.textPrimary,
              marginBottom: spacing.md,
            }}
          >
            Log Activity
          </Text>

          <View style={{ marginBottom: spacing.md }}>
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.textSecondary,
                marginBottom: spacing.sm,
              }}
            >
              {goalUnit.charAt(0).toUpperCase() + goalUnit.slice(1)}
            </Text>
            <TextInput
              testID={TestIDs.logActivity.valueInput}
              style={{
                padding: 14,
                fontSize: typography.fontSize.lg,
                fontFamily: "PlusJakartaSans_600SemiBold",
                color: colors.textPrimary,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.xl,
              }}
              value={value}
              onChangeText={setValue}
              placeholder={challengeType === "steps" ? "5000" : "30"}
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              autoFocus
              accessibilityLabel={`Enter ${goalUnit} amount`}
            />
          </View>

          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <TouchableOpacity
              testID={TestIDs.logActivity.cancelButton}
              style={{
                flex: 1,
                padding: 14,
                backgroundColor: "transparent",
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.xl,
                alignItems: "center",
              }}
              onPress={onClose}
              accessibilityLabel="Cancel logging activity"
              accessibilityRole="button"
            >
              <Text
                style={{
                  fontSize: typography.fontSize.base - 1,
                  fontFamily: "PlusJakartaSans_600SemiBold",
                  color: colors.textSecondary,
                }}
              >
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID={TestIDs.logActivity.submitButton}
              style={{
                flex: 1,
                padding: 14,
                backgroundColor: colors.primary.main,
                borderRadius: radius.xl,
                alignItems: "center",
                opacity: isLoading ? 0.7 : 1,
              }}
              onPress={handleSubmit}
              disabled={isLoading}
              accessibilityLabel="Submit activity"
              accessibilityRole="button"
            >
              <Text
                style={{
                  fontSize: typography.fontSize.base - 1,
                  fontFamily: "PlusJakartaSans_600SemiBold",
                  color: "#FFFFFF",
                }}
              >
                {isLoading ? "Logging..." : "Log Activity"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
