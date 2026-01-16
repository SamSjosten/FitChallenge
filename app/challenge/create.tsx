// app/challenge/create.tsx
// Create new challenge screen - Design System v1.0
// Matches mockup: activity grid, styled form, summary card

import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  TextInput,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useCreateChallenge } from "@/hooks/useChallenges";
import { useAppTheme } from "@/providers/ThemeProvider";
import { pushTokenService } from "@/services/pushTokens";
import { getServerNow } from "@/lib/serverTime";
import { ChevronLeftIcon, XMarkIcon } from "react-native-heroicons/outline";
import type { ChallengeType } from "@/types/database";

const CHALLENGE_TYPES: {
  value: ChallengeType;
  label: string;
  unit: string;
  icon: string;
}[] = [
  { value: "steps", label: "Steps", unit: "steps", icon: "👟" },
  {
    value: "active_minutes",
    label: "Active Minutes",
    unit: "minutes",
    icon: "⏱️",
  },
  { value: "workouts", label: "Workouts", unit: "workouts", icon: "💪" },
  { value: "distance", label: "Distance", unit: "km", icon: "🏃" },
  { value: "custom", label: "Custom", unit: "units", icon: "✨" },
];

const DURATION_PRESETS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "Custom", value: 0 },
];

type StartMode = "now" | "scheduled";

export default function CreateChallengeScreen() {
  const { colors, spacing, radius, typography, shadows } = useAppTheme();
  const createChallenge = useCreateChallenge();

  // Basic fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [challengeType, setChallengeType] = useState<ChallengeType>("steps");
  const [goalValue, setGoalValue] = useState("");
  const [customActivityName, setCustomActivityName] = useState("");
  const [customUnit, setCustomUnit] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Scheduling fields
  const [startMode, setStartMode] = useState<StartMode>("now");
  const [scheduledStart, setScheduledStart] = useState<Date>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Duration fields
  const [durationPreset, setDurationPreset] = useState(7);
  const [customDuration, setCustomDuration] = useState("7");

  const selectedType = CHALLENGE_TYPES.find((t) => t.value === challengeType)!;
  const displayUnit =
    challengeType === "custom" ? customUnit || "units" : selectedType.unit;
  const effectiveDuration =
    durationPreset === 0 ? parseInt(customDuration) || 0 : durationPreset;

  const getTimezoneLabel = () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const shortTz = new Date()
      .toLocaleTimeString("en-US", { timeZoneName: "short" })
      .split(" ")
      .pop();
    return `${shortTz} (${tz})`;
  };

  const getStartDate = (): Date => {
    if (startMode === "now") {
      // Use server time to ensure consistency with challenge visibility queries
      return new Date(getServerNow().getTime() + 60000);
    }
    return scheduledStart;
  };

  const getEndDate = (): Date => {
    const start = getStartDate();
    return new Date(start.getTime() + effectiveDuration * 24 * 60 * 60 * 1000);
  };

  const handleDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (event.type === "set" && selectedDate) {
      const newDate = new Date(scheduledStart);
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      setScheduledStart(newDate);
      if (Platform.OS === "android") {
        setTimeout(() => setShowTimePicker(true), 100);
      }
    }
  };

  const handleTimeChange = (
    event: DateTimePickerEvent,
    selectedTime?: Date
  ) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    if (event.type === "set" && selectedTime) {
      const newDate = new Date(scheduledStart);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setScheduledStart(newDate);
    }
  };

  const handleCreate = async () => {
    setError(null);

    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!goalValue || parseInt(goalValue) <= 0) {
      setError("Please enter a valid goal");
      return;
    }
    if (effectiveDuration <= 0 || effectiveDuration > 365) {
      setError("Duration must be between 1 and 365 days");
      return;
    }
    if (challengeType === "custom" && !customActivityName.trim()) {
      setError("Please enter a custom activity name");
      return;
    }
    if (challengeType === "custom" && !customUnit.trim()) {
      setError("Please enter a unit for your custom activity");
      return;
    }

    const startDate = getStartDate();
    const endDate = getEndDate();

    if (startMode === "scheduled" && startDate <= getServerNow()) {
      setError("Scheduled start must be in the future");
      return;
    }

    try {
      await createChallenge.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        challenge_type: challengeType,
        custom_activity_name:
          challengeType === "custom" ? customActivityName.trim() : undefined,
        goal_value: parseInt(goalValue),
        goal_unit:
          challengeType === "custom" ? customUnit.trim() : selectedType.unit,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        win_condition: "highest_total",
      });

      // Request notification permission contextually (non-blocking)
      // User just created a challenge, they'll want updates about participants
      pushTokenService
        .requestAndRegister()
        .catch((err) => console.warn("Push notification setup failed:", err));

      const startMsg =
        startMode === "now"
          ? "starting in 1 minute"
          : `starting ${startDate.toLocaleDateString()}`;

      Alert.alert(
        "Challenge Created! 🎉",
        `Your challenge is ready, ${startMsg}. Invite friends to join!`,
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (err: any) {
      setError(err.message || "Failed to create challenge");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: spacing.xl,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginRight: spacing.sm }}
          >
            <ChevronLeftIcon size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text
            style={{
              fontSize: typography.fontSize.xl,
              fontFamily: "PlusJakartaSans_700Bold",
              color: colors.textPrimary,
            }}
          >
            Create Challenge
          </Text>
        </View>

        {/* Title Input */}
        <Text
          style={{
            fontSize: typography.fontSize.sm,
            fontFamily: "PlusJakartaSans_600SemiBold",
            color: colors.textSecondary,
            marginBottom: spacing.xs,
          }}
        >
          Challenge Title
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
            marginBottom: spacing.lg,
          }}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g., Summer Step Challenge"
          placeholderTextColor={colors.textMuted}
          maxLength={100}
        />

        {/* Description */}
        <Text
          style={{
            fontSize: typography.fontSize.sm,
            fontFamily: "PlusJakartaSans_600SemiBold",
            color: colors.textSecondary,
            marginBottom: spacing.xs,
          }}
        >
          Description (optional)
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
            marginBottom: spacing.lg,
            minHeight: 80,
            textAlignVertical: "top",
          }}
          value={description}
          onChangeText={setDescription}
          placeholder="What's this challenge about?"
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={3}
          maxLength={500}
        />

        {/* Activity Type Grid */}
        <Text
          style={{
            fontSize: typography.fontSize.sm,
            fontFamily: "PlusJakartaSans_600SemiBold",
            color: colors.textSecondary,
            marginBottom: spacing.sm,
          }}
        >
          Activity Type
        </Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: spacing.sm,
            marginBottom: spacing.lg,
          }}
        >
          {CHALLENGE_TYPES.map((type) => {
            const isSelected = challengeType === type.value;
            return (
              <TouchableOpacity
                key={type.value}
                style={{
                  width: "48%",
                  backgroundColor: isSelected
                    ? colors.primary.subtle
                    : colors.surface,
                  borderRadius: radius.card,
                  padding: spacing.md,
                  borderWidth: 2,
                  borderColor: isSelected ? colors.primary.main : "transparent",
                  alignItems: "center",
                  ...shadows.card,
                }}
                onPress={() => setChallengeType(type.value)}
              >
                <Text style={{ fontSize: 24, marginBottom: spacing.xs }}>
                  {type.icon}
                </Text>
                <Text
                  style={{
                    fontSize: typography.fontSize.sm,
                    fontFamily: "PlusJakartaSans_600SemiBold",
                    color: isSelected
                      ? colors.primary.main
                      : colors.textPrimary,
                  }}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Custom Activity Fields */}
        {challengeType === "custom" && (
          <View style={{ marginBottom: spacing.lg }}>
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontFamily: "PlusJakartaSans_600SemiBold",
                color: colors.textSecondary,
                marginBottom: spacing.xs,
              }}
            >
              Activity Name
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
              value={customActivityName}
              onChangeText={setCustomActivityName}
              placeholder="e.g., Pushups, Meditation"
              placeholderTextColor={colors.textMuted}
              maxLength={50}
            />
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontFamily: "PlusJakartaSans_600SemiBold",
                color: colors.textSecondary,
                marginBottom: spacing.xs,
              }}
            >
              Unit
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
              }}
              value={customUnit}
              onChangeText={setCustomUnit}
              placeholder="e.g., reps, minutes"
              placeholderTextColor={colors.textMuted}
              maxLength={20}
            />
          </View>
        )}

        {/* Goal Input */}
        <Text
          style={{
            fontSize: typography.fontSize.sm,
            fontFamily: "PlusJakartaSans_600SemiBold",
            color: colors.textSecondary,
            marginBottom: spacing.xs,
          }}
        >
          Goal ({displayUnit})
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
            marginBottom: spacing.lg,
          }}
          value={goalValue}
          onChangeText={setGoalValue}
          placeholder="e.g., 10000"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
        />

        {/* Start Mode Toggle */}
        <Text
          style={{
            fontSize: typography.fontSize.sm,
            fontFamily: "PlusJakartaSans_600SemiBold",
            color: colors.textSecondary,
            marginBottom: spacing.sm,
          }}
        >
          When to Start
        </Text>
        <View
          style={{
            flexDirection: "row",
            backgroundColor: colors.surface,
            borderRadius: radius.button,
            padding: spacing.xs,
            marginBottom: spacing.lg,
          }}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              alignItems: "center",
              borderRadius: radius.button - 4,
              backgroundColor:
                startMode === "now" ? colors.primary.main : "transparent",
            }}
            onPress={() => setStartMode("now")}
          >
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontFamily: "PlusJakartaSans_600SemiBold",
                color: startMode === "now" ? "#FFFFFF" : colors.textSecondary,
              }}
            >
              Start Now
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              alignItems: "center",
              borderRadius: radius.button - 4,
              backgroundColor:
                startMode === "scheduled" ? colors.primary.main : "transparent",
            }}
            onPress={() => setStartMode("scheduled")}
          >
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontFamily: "PlusJakartaSans_600SemiBold",
                color:
                  startMode === "scheduled" ? "#FFFFFF" : colors.textSecondary,
              }}
            >
              Schedule
            </Text>
          </TouchableOpacity>
        </View>

        {/* Schedule Picker */}
        {startMode === "scheduled" && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.card,
              padding: spacing.lg,
              marginBottom: spacing.lg,
              ...shadows.card,
            }}
          >
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontFamily: "PlusJakartaSans_600SemiBold",
                color: colors.textPrimary,
                marginBottom: spacing.md,
              }}
            >
              Choose start date & time
            </Text>

            <TouchableOpacity
              style={{
                backgroundColor: colors.background,
                padding: spacing.md,
                borderRadius: radius.input,
                marginBottom: spacing.sm,
              }}
              onPress={() => setShowDatePicker(true)}
            >
              <Text
                style={{
                  fontSize: typography.fontSize.base,
                  fontFamily: "PlusJakartaSans_500Medium",
                  color: colors.primary.main,
                  textAlign: "center",
                }}
              >
                📅 {scheduledStart.toLocaleDateString()}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: colors.background,
                padding: spacing.md,
                borderRadius: radius.input,
              }}
              onPress={() => setShowTimePicker(true)}
            >
              <Text
                style={{
                  fontSize: typography.fontSize.base,
                  fontFamily: "PlusJakartaSans_500Medium",
                  color: colors.primary.main,
                  textAlign: "center",
                }}
              >
                🕐{" "}
                {scheduledStart.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </TouchableOpacity>

            {/* iOS Inline Pickers */}
            {Platform.OS === "ios" && showDatePicker && (
              <View style={{ marginTop: spacing.md, alignItems: "center" }}>
                <DateTimePicker
                  value={scheduledStart}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  minimumDate={new Date()}
                />
                <TouchableOpacity
                  style={{
                    backgroundColor: colors.primary.main,
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.button,
                    marginTop: spacing.sm,
                  }}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text
                    style={{
                      fontSize: typography.fontSize.sm,
                      fontFamily: "PlusJakartaSans_600SemiBold",
                      color: "#FFFFFF",
                    }}
                  >
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {Platform.OS === "ios" && showTimePicker && (
              <View style={{ marginTop: spacing.md, alignItems: "center" }}>
                <DateTimePicker
                  value={scheduledStart}
                  mode="time"
                  display="spinner"
                  onChange={handleTimeChange}
                />
                <TouchableOpacity
                  style={{
                    backgroundColor: colors.primary.main,
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.button,
                    marginTop: spacing.sm,
                  }}
                  onPress={() => setShowTimePicker(false)}
                >
                  <Text
                    style={{
                      fontSize: typography.fontSize.sm,
                      fontFamily: "PlusJakartaSans_600SemiBold",
                      color: "#FFFFFF",
                    }}
                  >
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Android Pickers */}
        {Platform.OS === "android" && showDatePicker && (
          <DateTimePicker
            value={scheduledStart}
            mode="date"
            display="default"
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}
        {Platform.OS === "android" && showTimePicker && (
          <DateTimePicker
            value={scheduledStart}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        )}

        {/* Duration */}
        <Text
          style={{
            fontSize: typography.fontSize.sm,
            fontFamily: "PlusJakartaSans_600SemiBold",
            color: colors.textSecondary,
            marginBottom: spacing.sm,
          }}
        >
          Duration
        </Text>
        <View
          style={{
            flexDirection: "row",
            gap: spacing.sm,
            marginBottom: spacing.lg,
          }}
        >
          {DURATION_PRESETS.map((preset) => {
            const isSelected = durationPreset === preset.value;
            return (
              <TouchableOpacity
                key={preset.value}
                style={{
                  flex: 1,
                  paddingVertical: spacing.sm,
                  backgroundColor: isSelected
                    ? colors.primary.main
                    : colors.surface,
                  borderRadius: radius.button,
                  alignItems: "center",
                  ...shadows.card,
                }}
                onPress={() => setDurationPreset(preset.value)}
              >
                <Text
                  style={{
                    fontSize: typography.fontSize.xs,
                    fontFamily: "PlusJakartaSans_600SemiBold",
                    color: isSelected ? "#FFFFFF" : colors.textSecondary,
                  }}
                >
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Custom Duration */}
        {durationPreset === 0 && (
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
              marginBottom: spacing.lg,
            }}
            value={customDuration}
            onChangeText={setCustomDuration}
            placeholder="Number of days"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
          />
        )}

        {/* Summary Card */}
        <View
          style={{
            backgroundColor: colors.primary.subtle,
            borderRadius: radius.card,
            padding: spacing.lg,
            marginBottom: spacing.lg,
            borderWidth: 1,
            borderColor: colors.primary.main,
          }}
        >
          <Text
            style={{
              fontSize: typography.fontSize.sm,
              fontFamily: "PlusJakartaSans_700Bold",
              color: colors.primary.dark,
              marginBottom: spacing.sm,
            }}
          >
            Challenge Summary
          </Text>
          <Text
            style={{
              fontSize: typography.fontSize.base,
              fontFamily: "PlusJakartaSans_500Medium",
              color: colors.textPrimary,
              marginBottom: spacing.md,
            }}
          >
            {title || "Your challenge"} • {goalValue || "?"} {displayUnit} in{" "}
            {effectiveDuration || "?"} days
          </Text>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: spacing.xs,
            }}
          >
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.textMuted,
              }}
            >
              Starts:
            </Text>
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontFamily: "PlusJakartaSans_600SemiBold",
                color: colors.textPrimary,
              }}
            >
              {startMode === "now"
                ? "In 1 minute"
                : scheduledStart.toLocaleString()}
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: spacing.sm,
            }}
          >
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.textMuted,
              }}
            >
              Ends:
            </Text>
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontFamily: "PlusJakartaSans_600SemiBold",
                color: colors.textPrimary,
              }}
            >
              {effectiveDuration > 0
                ? getEndDate().toLocaleString()
                : "Set duration"}
            </Text>
          </View>
          <Text
            style={{
              fontSize: typography.fontSize.xs,
              fontFamily: "PlusJakartaSans_500Medium",
              color: colors.textMuted,
              textAlign: "center",
              fontStyle: "italic",
            }}
          >
            Times in {getTimezoneLabel()}
          </Text>
        </View>

        {/* Error */}
        {error && (
          <Text
            style={{
              fontSize: typography.fontSize.sm,
              fontFamily: "PlusJakartaSans_500Medium",
              color: colors.error,
              textAlign: "center",
              marginBottom: spacing.md,
            }}
          >
            {error}
          </Text>
        )}

        {/* Create Button */}
        <TouchableOpacity
          style={{
            backgroundColor: colors.primary.main,
            borderRadius: radius.button,
            paddingVertical: spacing.md,
            alignItems: "center",
            opacity: createChallenge.isPending ? 0.7 : 1,
          }}
          onPress={handleCreate}
          disabled={createChallenge.isPending}
        >
          <Text
            style={{
              fontSize: typography.fontSize.base,
              fontFamily: "PlusJakartaSans_700Bold",
              color: "#FFFFFF",
            }}
          >
            {createChallenge.isPending ? "Creating..." : "Create Challenge"}
          </Text>
        </TouchableOpacity>

        {/* Cancel */}
        <TouchableOpacity
          style={{
            backgroundColor: "transparent",
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.button,
            paddingVertical: spacing.md,
            alignItems: "center",
            marginTop: spacing.sm,
          }}
          onPress={() => router.back()}
        >
          <Text
            style={{
              fontSize: typography.fontSize.base,
              fontFamily: "PlusJakartaSans_600SemiBold",
              color: colors.textSecondary,
            }}
          >
            Cancel
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
