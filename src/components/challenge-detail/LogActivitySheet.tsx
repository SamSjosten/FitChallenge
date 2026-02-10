// src/components/challenge-detail/LogActivitySheet.tsx
//
// CONTRACTS ENFORCED:
// - Owns its own input state — parent doesn't manage activityValue string
// - Calls onSubmit with a validated number, not a string
// - Uses parseInt with radix parameter (fixes Q4)
// - Workout mode: calls onSubmitWorkout with workout_type + duration_minutes
// - Points preview is informational only — server is authoritative

import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import { ChevronDownIcon, ChevronUpIcon } from "react-native-heroicons/outline";
import { TestIDs } from "@/constants/testIDs";
import { WORKOUT_TYPE_CATALOG } from "@/components/create-challenge/types";
import type { LogActivitySheetProps } from "./types";

export function LogActivitySheet({
  visible,
  onClose,
  onSubmit,
  onSubmitWorkout,
  isLoading,
  goalUnit,
  challengeType,
  allowedWorkoutTypes,
}: LogActivitySheetProps) {
  const { colors, spacing, radius, typography } = useAppTheme();
  const [value, setValue] = useState("");
  const [selectedWorkoutType, setSelectedWorkoutType] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState("");
  const [showTypePicker, setShowTypePicker] = useState(false);

  const isWorkoutMode = challengeType === "workouts" && !!onSubmitWorkout;

  // Available workout types for this challenge
  const availableTypes = useMemo(() => {
    if (!isWorkoutMode) return [];
    if (!allowedWorkoutTypes || allowedWorkoutTypes.length === 0) {
      return WORKOUT_TYPE_CATALOG;
    }
    return WORKOUT_TYPE_CATALOG.filter((t) => allowedWorkoutTypes.includes(t.id));
  }, [isWorkoutMode, allowedWorkoutTypes]);

  // Auto-select first available type
  useEffect(() => {
    if (isWorkoutMode && availableTypes.length > 0 && !selectedWorkoutType) {
      setSelectedWorkoutType(availableTypes[0].id);
    }
  }, [isWorkoutMode, availableTypes, selectedWorkoutType]);

  // Reset input when sheet closes
  useEffect(() => {
    if (!visible) {
      setValue("");
      setDurationMinutes("");
      setSelectedWorkoutType(null);
      setShowTypePicker(false);
    }
  }, [visible]);

  if (!visible) return null;

  // Points preview (informational only — server calculates actual points)
  const selectedType = availableTypes.find((t) => t.id === selectedWorkoutType);
  const parsedDuration = parseInt(durationMinutes, 10);
  const pointsPreview =
    selectedType && !isNaN(parsedDuration) && parsedDuration > 0
      ? Math.floor(parsedDuration * selectedType.multiplier)
      : null;

  const handleSubmit = () => {
    if (isWorkoutMode) {
      if (!selectedWorkoutType) {
        Alert.alert("Select Workout", "Please select a workout type");
        return;
      }
      const duration = parseInt(durationMinutes, 10);
      if (isNaN(duration) || duration <= 0) {
        Alert.alert("Invalid Duration", "Please enter a positive number");
        return;
      }
      if (duration > 1440) {
        Alert.alert("Invalid Duration", "Duration cannot exceed 24 hours");
        return;
      }
      onSubmitWorkout!(selectedWorkoutType, duration);
    } else {
      const parsed = parseInt(value, 10);
      if (isNaN(parsed) || parsed <= 0) {
        Alert.alert("Invalid Value", "Please enter a positive number");
        return;
      }
      onSubmit(parsed);
    }
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
            maxHeight: "70%",
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
            {isWorkoutMode ? "Log Workout" : "Log Activity"}
          </Text>

          {isWorkoutMode ? (
            // ─── Workout Mode ───
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{ marginBottom: spacing.md }}
            >
              {/* Workout Type Picker */}
              <Text
                style={{
                  fontSize: typography.fontSize.sm,
                  fontFamily: "PlusJakartaSans_500Medium",
                  color: colors.textSecondary,
                  marginBottom: spacing.sm,
                }}
              >
                Workout Type
              </Text>
              <TouchableOpacity
                onPress={() => setShowTypePicker(!showTypePicker)}
                activeOpacity={0.7}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.xl,
                  marginBottom: showTypePicker ? 0 : spacing.md,
                }}
              >
                <Text
                  style={{
                    fontSize: typography.fontSize.base,
                    fontFamily: "PlusJakartaSans_600SemiBold",
                    color: selectedType ? colors.textPrimary : colors.textMuted,
                  }}
                >
                  {selectedType?.name || "Select workout"}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {selectedType && (
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: "PlusJakartaSans_600SemiBold",
                        color: colors.textSecondary,
                      }}
                    >
                      {selectedType.multiplier}×
                    </Text>
                  )}
                  {showTypePicker ? (
                    <ChevronUpIcon size={18} color={colors.textSecondary} />
                  ) : (
                    <ChevronDownIcon size={18} color={colors.textSecondary} />
                  )}
                </View>
              </TouchableOpacity>

              {showTypePicker && (
                <View
                  style={{
                    borderWidth: 1,
                    borderTopWidth: 0,
                    borderColor: colors.border,
                    borderBottomLeftRadius: radius.xl,
                    borderBottomRightRadius: radius.xl,
                    marginBottom: spacing.md,
                    maxHeight: 200,
                  }}
                >
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                    {availableTypes.map((wt) => (
                      <TouchableOpacity
                        key={wt.id}
                        onPress={() => {
                          setSelectedWorkoutType(wt.id);
                          setShowTypePicker(false);
                        }}
                        activeOpacity={0.7}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          backgroundColor:
                            wt.id === selectedWorkoutType
                              ? colors.primary.main + "10"
                              : "transparent",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 14,
                            fontFamily:
                              wt.id === selectedWorkoutType
                                ? "PlusJakartaSans_600SemiBold"
                                : "PlusJakartaSans_400Regular",
                            color:
                              wt.id === selectedWorkoutType
                                ? colors.primary.main
                                : colors.textPrimary,
                          }}
                        >
                          {wt.name}
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            fontFamily: "PlusJakartaSans_500Medium",
                            color: colors.textSecondary,
                          }}
                        >
                          {wt.multiplier}×
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Duration Input */}
              <Text
                style={{
                  fontSize: typography.fontSize.sm,
                  fontFamily: "PlusJakartaSans_500Medium",
                  color: colors.textSecondary,
                  marginBottom: spacing.sm,
                }}
              >
                Duration (minutes)
              </Text>
              <TextInput
                style={{
                  padding: 14,
                  fontSize: typography.fontSize.lg,
                  fontFamily: "PlusJakartaSans_600SemiBold",
                  color: colors.textPrimary,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.xl,
                  marginBottom: spacing.sm,
                }}
                value={durationMinutes}
                onChangeText={setDurationMinutes}
                placeholder="30"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                autoFocus={!showTypePicker}
                accessibilityLabel="Enter workout duration in minutes"
              />

              {/* Points Preview */}
              {pointsPreview !== null && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    backgroundColor: colors.primary.main + "10",
                    borderRadius: radius.lg,
                    marginBottom: spacing.sm,
                    gap: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: "PlusJakartaSans_500Medium",
                      color: colors.textSecondary,
                    }}
                  >
                    ≈
                  </Text>
                  <Text
                    style={{
                      fontSize: 20,
                      fontFamily: "PlusJakartaSans_700Bold",
                      color: colors.primary.main,
                    }}
                  >
                    {pointsPreview}
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: "PlusJakartaSans_500Medium",
                      color: colors.textSecondary,
                    }}
                  >
                    points
                  </Text>
                </View>
              )}
            </ScrollView>
          ) : (
            // ─── Standard Mode ───
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
          )}

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
                {isLoading ? "Logging..." : isWorkoutMode ? "Log Workout" : "Log Activity"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
