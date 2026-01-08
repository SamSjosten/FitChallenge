// app/challenge/create.tsx
// Create new challenge screen with scheduling options

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useCreateChallenge } from "@/hooks/useChallenges";
import { Button, Input, Card } from "@/components/ui";
import type { ChallengeType } from "@/types/database";

const CHALLENGE_TYPES: { value: ChallengeType; label: string; unit: string }[] =
  [
    { value: "steps", label: "👟 Steps", unit: "steps" },
    { value: "active_minutes", label: "⏱️ Active Minutes", unit: "minutes" },
    { value: "workouts", label: "💪 Workouts", unit: "workouts" },
    { value: "distance", label: "🏃 Distance", unit: "km" },
  ];

const DURATION_PRESETS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "Custom", value: 0 },
];

type StartMode = "now" | "scheduled";

export default function CreateChallengeScreen() {
  const createChallenge = useCreateChallenge();

  // Basic fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [challengeType, setChallengeType] = useState<ChallengeType>("steps");
  const [goalValue, setGoalValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Scheduling fields
  const [startMode, setStartMode] = useState<StartMode>("now");
  const [scheduledStart, setScheduledStart] = useState<Date>(() => {
    // Default to tomorrow at 9am
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

  // Get effective duration
  const effectiveDuration =
    durationPreset === 0 ? parseInt(customDuration) || 0 : durationPreset;

  // Get timezone abbreviation for display
  const getTimezoneLabel = () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Get short timezone name (e.g., "CST", "EST")
    const shortTz = new Date()
      .toLocaleTimeString("en-US", { timeZoneName: "short" })
      .split(" ")
      .pop();
    return `${shortTz} (${tz})`;
  };

  // Calculate start and end dates
  const getStartDate = (): Date => {
    if (startMode === "now") {
      return new Date(Date.now() + 60000); // Start in 1 minute
    }
    return scheduledStart;
  };

  const getEndDate = (): Date => {
    const start = getStartDate();
    return new Date(start.getTime() + effectiveDuration * 24 * 60 * 60 * 1000);
  };

  // Date picker handlers
  const handleDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (event.type === "set" && selectedDate) {
      // Preserve the time, update the date
      const newDate = new Date(scheduledStart);
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      setScheduledStart(newDate);

      // On Android, show time picker after date is selected
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
      // Preserve the date, update the time
      const newDate = new Date(scheduledStart);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setScheduledStart(newDate);
    }
  };

  const handleCreate = async () => {
    setError(null);

    // Basic validation
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

    const startDate = getStartDate();
    const endDate = getEndDate();

    // Validate scheduled start is in the future
    if (startMode === "scheduled" && startDate <= new Date()) {
      setError("Scheduled start must be in the future");
      return;
    }

    try {
      await createChallenge.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        challenge_type: challengeType,
        goal_value: parseInt(goalValue),
        goal_unit: selectedType.unit,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        win_condition: "highest_total",
      });

      const startMsg =
        startMode === "now"
          ? "starting in 1 minute"
          : `starting ${startDate.toLocaleDateString()}`;

      Alert.alert(
        "Challenge Created! 🎉",
        `Your challenge is ready, ${startMsg}. Invite friends to join!`,
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
    } catch (err: any) {
      setError(err.message || "Failed to create challenge");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.header}>Create a Challenge</Text>

        {/* Title */}
        <Input
          label="Challenge Title"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g., Summer Step Challenge"
          maxLength={100}
        />

        {/* Description */}
        <Input
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="What's this challenge about?"
          multiline
          numberOfLines={3}
          maxLength={500}
        />

        {/* Challenge Type */}
        <Text style={styles.label}>Challenge Type</Text>
        <View style={styles.typeGrid}>
          {CHALLENGE_TYPES.map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.typeCard,
                challengeType === type.value && styles.typeCardSelected,
              ]}
              onPress={() => setChallengeType(type.value)}
            >
              <Text style={styles.typeLabel}>{type.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Goal */}
        <Input
          label={`Goal (${selectedType.unit})`}
          value={goalValue}
          onChangeText={setGoalValue}
          placeholder={`e.g., 10000`}
          keyboardType="number-pad"
        />

        {/* Start Mode Toggle */}
        <Text style={styles.label}>When to Start</Text>
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              startMode === "now" && styles.toggleButtonSelected,
            ]}
            onPress={() => setStartMode("now")}
          >
            <Text
              style={[
                styles.toggleText,
                startMode === "now" && styles.toggleTextSelected,
              ]}
            >
              Start Now
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              startMode === "scheduled" && styles.toggleButtonSelected,
            ]}
            onPress={() => setStartMode("scheduled")}
          >
            <Text
              style={[
                styles.toggleText,
                startMode === "scheduled" && styles.toggleTextSelected,
              ]}
            >
              Schedule Start
            </Text>
          </TouchableOpacity>
        </View>

        {/* Scheduled Start Date/Time Picker */}
        {startMode === "scheduled" && (
          <Card style={styles.schedulePicker}>
            <Text style={styles.scheduleLabel}>Start Date & Time</Text>

            {/* Date Button */}
            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateTimeButtonText}>
                📅 {scheduledStart.toLocaleDateString()}
              </Text>
            </TouchableOpacity>

            {/* Time Button */}
            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={styles.dateTimeButtonText}>
                🕐{" "}
                {scheduledStart.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </TouchableOpacity>

            {/* iOS shows inline pickers */}
            {Platform.OS === "ios" && showDatePicker && (
              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={scheduledStart}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  minimumDate={new Date()}
                />
                <Button
                  title="Done"
                  size="small"
                  onPress={() => setShowDatePicker(false)}
                />
              </View>
            )}

            {Platform.OS === "ios" && showTimePicker && (
              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={scheduledStart}
                  mode="time"
                  display="spinner"
                  onChange={handleTimeChange}
                />
                <Button
                  title="Done"
                  size="small"
                  onPress={() => setShowTimePicker(false)}
                />
              </View>
            )}
          </Card>
        )}

        {/* Android modal pickers */}
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

        {/* Duration Presets */}
        <Text style={styles.label}>Duration</Text>
        <View style={styles.presetGrid}>
          {DURATION_PRESETS.map((preset) => (
            <TouchableOpacity
              key={preset.value}
              style={[
                styles.presetButton,
                durationPreset === preset.value && styles.presetButtonSelected,
              ]}
              onPress={() => setDurationPreset(preset.value)}
            >
              <Text
                style={[
                  styles.presetText,
                  durationPreset === preset.value && styles.presetTextSelected,
                ]}
              >
                {preset.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom Duration Input */}
        {durationPreset === 0 && (
          <Input
            label="Custom Duration (days)"
            value={customDuration}
            onChangeText={setCustomDuration}
            placeholder="e.g., 21"
            keyboardType="number-pad"
          />
        )}

        {/* Summary */}
        <Card style={styles.summary}>
          <Text style={styles.summaryTitle}>Challenge Summary</Text>
          <Text style={styles.summaryText}>
            {title || "Your challenge"} • {goalValue || "?"} {selectedType.unit}{" "}
            in {effectiveDuration || "?"} days
          </Text>
          <View style={styles.summaryDates}>
            <Text style={styles.summaryDateLabel}>Starts:</Text>
            <Text style={styles.summaryDateValue}>
              {startMode === "now"
                ? "In 1 minute"
                : scheduledStart.toLocaleString()}
            </Text>
          </View>
          <View style={styles.summaryDates}>
            <Text style={styles.summaryDateLabel}>Ends:</Text>
            <Text style={styles.summaryDateValue}>
              {effectiveDuration > 0
                ? getEndDate().toLocaleString()
                : "Set duration"}
            </Text>
          </View>
          <Text style={styles.timezoneLabel}>
            Times in {getTimezoneLabel()}
          </Text>
        </Card>

        {/* Error */}
        {error && <Text style={styles.error}>{error}</Text>}

        {/* Create Button */}
        <Button
          title="Create Challenge"
          onPress={handleCreate}
          loading={createChallenge.isPending}
          disabled={createChallenge.isPending}
          size="large"
        />

        {/* Cancel */}
        <Button
          title="Cancel"
          variant="outline"
          onPress={() => router.back()}
          style={styles.cancelButton}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 8,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  typeCard: {
    flex: 1,
    minWidth: "45%",
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
  },
  typeCardSelected: {
    borderColor: "#007AFF",
    backgroundColor: "#F0F8FF",
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  // Start Mode Toggle
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: "#E5E5EA",
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 6,
  },
  toggleButtonSelected: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  toggleTextSelected: {
    color: "#007AFF",
  },
  // Schedule Picker
  schedulePicker: {
    marginBottom: 16,
    padding: 16,
  },
  scheduleLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  dateTimeButton: {
    backgroundColor: "#F2F2F7",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  dateTimeButtonText: {
    fontSize: 16,
    color: "#007AFF",
    textAlign: "center",
  },
  pickerContainer: {
    marginTop: 8,
    alignItems: "center",
  },
  // Duration Presets
  presetGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  presetButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
  },
  presetButtonSelected: {
    borderColor: "#007AFF",
    backgroundColor: "#F0F8FF",
  },
  presetText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666",
  },
  presetTextSelected: {
    color: "#007AFF",
  },
  // Summary
  summary: {
    marginBottom: 16,
    backgroundColor: "#F0F8FF",
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#007AFF",
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: "#333",
    marginBottom: 12,
  },
  summaryDates: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  summaryDateLabel: {
    fontSize: 13,
    color: "#666",
  },
  summaryDateValue: {
    fontSize: 13,
    fontWeight: "500",
    color: "#333",
  },
  timezoneLabel: {
    fontSize: 11,
    color: "#999",
    marginTop: 8,
    textAlign: "center",
    fontStyle: "italic",
  },
  error: {
    color: "#FF3B30",
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  cancelButton: {
    marginTop: 12,
  },
});
