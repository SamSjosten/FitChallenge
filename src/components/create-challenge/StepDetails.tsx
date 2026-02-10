// src/components/create-challenge/StepDetails.tsx
// Step 2: Challenge details - name, goal, duration, start time, win condition

import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useAppTheme } from "@/providers/ThemeProvider";
import { TrophyIcon, InformationCircleIcon } from "react-native-heroicons/outline";
import {
  CHALLENGE_TYPES,
  DURATION_PRESETS,
  WIN_CONDITIONS,
  type StepDetailsProps,
  type DurationPresetId,
  type WinConditionId,
  type CreateFormData,
} from "./types";

export function StepDetails({
  mode,
  challengeType,
  formData,
  setFormData,
  onNext,
  onBack,
}: StepDetailsProps) {
  const { colors, radius, spacing } = useAppTheme();
  const typeConfig = CHALLENGE_TYPES.find((t) => t.id === challengeType);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const update = (partial: Partial<CreateFormData>) => setFormData({ ...formData, ...partial });

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (event.type === "set" && selectedDate) {
      const newDate = new Date(formData.scheduledStart);
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      update({ scheduledStart: newDate });
      // Android: chain date → time picker
      if (Platform.OS === "android") {
        setTimeout(() => setShowTimePicker(true), 100);
      }
    }
  };

  const handleTimeChange = (event: DateTimePickerEvent, selectedTime?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    if (event.type === "set" && selectedTime) {
      const newDate = new Date(formData.scheduledStart);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      update({ scheduledStart: newDate });
    }
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderRadius: radius["2xl"],
          },
        ]}
      >
        {/* Challenge Name */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {mode === "solo" ? "Goal Name" : "Challenge Name"}
          </Text>
          <TextInput
            value={formData.name}
            onChangeText={(v) => update({ name: v })}
            placeholder={
              mode === "solo" ? "e.g., 10K Steps Daily" : "e.g., Weekly Workout Warriors"
            }
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              {
                color: colors.textPrimary,
                borderColor: colors.border,
                borderRadius: radius.xl,
              },
            ]}
            maxLength={100}
          />
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Description{" "}
            <Text style={{ color: colors.textMuted, fontWeight: "400" }}>(optional)</Text>
          </Text>
          <TextInput
            value={formData.description}
            onChangeText={(v) => update({ description: v })}
            placeholder="What's this challenge about?"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={2}
            style={[
              styles.input,
              styles.textArea,
              {
                color: colors.textPrimary,
                borderColor: colors.border,
                borderRadius: radius.xl,
              },
            ]}
            maxLength={500}
          />
        </View>

        {/* Custom Activity Name (only for custom type) */}
        {challengeType === "custom" && (
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              What are you tracking?
            </Text>
            <TextInput
              value={formData.customUnit}
              onChangeText={(v) => update({ customUnit: v })}
              placeholder="e.g., glasses of water, books read"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                {
                  color: colors.textPrimary,
                  borderColor: colors.border,
                  borderRadius: radius.xl,
                },
              ]}
              maxLength={20}
            />
          </View>
        )}

        {/* Goal */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Goal</Text>
          <View style={styles.goalRow}>
            <TextInput
              value={formData.goal}
              onChangeText={(v) => update({ goal: v.replace(/[^0-9]/g, "") })}
              placeholder={typeConfig?.placeholder || "100"}
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              style={[
                styles.input,
                styles.goalInput,
                {
                  color: colors.textPrimary,
                  borderColor: colors.border,
                  borderRadius: radius.xl,
                },
              ]}
            />
            <View
              style={[
                styles.unitBadge,
                {
                  backgroundColor: colors.background,
                  borderRadius: radius.xl,
                },
              ]}
            >
              <Text style={[styles.unitText, { color: colors.textSecondary }]}>
                {challengeType === "custom" && formData.customUnit
                  ? formData.customUnit
                  : typeConfig?.unit || "units"}
              </Text>
            </View>
          </View>
          <View style={styles.hintRow}>
            <InformationCircleIcon size={14} color={colors.textMuted} />
            <Text style={[styles.hintText, { color: colors.textSecondary }]}>
              {typeConfig?.goalHint}
            </Text>
          </View>
        </View>

        {/* Daily Target (optional) */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Daily Target{" "}
            <Text style={{ color: colors.textMuted, fontWeight: "400" }}>(optional)</Text>
          </Text>
          <View style={styles.goalRow}>
            <TextInput
              value={formData.dailyTarget}
              onChangeText={(v) => update({ dailyTarget: v.replace(/[^0-9]/g, "") })}
              placeholder="e.g., 10000"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              style={[
                styles.input,
                styles.goalInput,
                {
                  color: colors.textPrimary,
                  borderColor: colors.border,
                  borderRadius: radius.xl,
                },
              ]}
            />
            <View
              style={[
                styles.unitBadge,
                {
                  backgroundColor: colors.background,
                  borderRadius: radius.xl,
                },
              ]}
            >
              <Text style={[styles.unitText, { color: colors.textSecondary }]}>per day</Text>
            </View>
          </View>
          <View style={styles.hintRow}>
            <InformationCircleIcon size={14} color={colors.textMuted} />
            <Text style={[styles.hintText, { color: colors.textSecondary }]}>
              Used for streak tracking. Leave blank for total-only goals.
            </Text>
          </View>
        </View>

        {/* Duration */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Duration</Text>
          <View style={styles.durationGrid}>
            {DURATION_PRESETS.map((d) => {
              const selected = formData.durationPreset === d.id;
              return (
                <TouchableOpacity
                  key={d.id}
                  onPress={() => update({ durationPreset: d.id })}
                  activeOpacity={0.7}
                  style={[
                    styles.durationChip,
                    {
                      borderRadius: radius.xl,
                      borderColor: selected ? colors.primary.main : colors.border,
                      backgroundColor: selected ? colors.primary.subtle : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.durationText,
                      {
                        color: selected ? colors.primary.dark : colors.textSecondary,
                        fontWeight: selected ? "600" : "500",
                      },
                    ]}
                  >
                    {d.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {formData.durationPreset === "custom" && (
            <TextInput
              value={formData.customDurationDays}
              onChangeText={(v) => update({ customDurationDays: v.replace(/[^0-9]/g, "") })}
              placeholder="Number of days"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              style={[
                styles.input,
                {
                  color: colors.textPrimary,
                  borderColor: colors.border,
                  borderRadius: radius.xl,
                  marginTop: 8,
                },
              ]}
            />
          )}
        </View>

        {/* Win Condition (social only) */}

        {/* Start Time */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Start Time</Text>
          <View
            style={[
              styles.startToggle,
              {
                backgroundColor: colors.background,
                borderRadius: radius.xl,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.startOption,
                {
                  borderRadius: radius.xl - 4,
                  backgroundColor:
                    formData.startMode === "now" ? colors.primary.main : "transparent",
                },
              ]}
              onPress={() => update({ startMode: "now" })}
            >
              <Text
                style={[
                  styles.startOptionText,
                  {
                    color: formData.startMode === "now" ? "#FFFFFF" : colors.textSecondary,
                  },
                ]}
              >
                Start Now
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.startOption,
                {
                  borderRadius: radius.xl - 4,
                  backgroundColor:
                    formData.startMode === "scheduled" ? colors.primary.main : "transparent",
                },
              ]}
              onPress={() => {
                // Fresh default: 1 hour from now, so the initial value is clearly in the future
                // even if the form was mounted minutes/steps ago
                const fresh = new Date(Date.now() + 3600000);
                fresh.setMinutes(0, 0, 0); // Round to next clean hour
                update({ startMode: "scheduled", scheduledStart: fresh });
              }}
            >
              <Text
                style={[
                  styles.startOptionText,
                  {
                    color: formData.startMode === "scheduled" ? "#FFFFFF" : colors.textSecondary,
                  },
                ]}
              >
                Schedule
              </Text>
            </TouchableOpacity>
          </View>

          {/* Scheduled date/time picker */}
          {formData.startMode === "scheduled" && (
            <View
              style={[
                styles.schedulePicker,
                {
                  backgroundColor: colors.background,
                  borderRadius: radius.xl,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.dateTimeButton,
                  {
                    borderColor: colors.border,
                    borderRadius: radius.xl,
                  },
                ]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={{ fontSize: 16 }}>📅</Text>
                <Text style={[styles.dateTimeText, { color: colors.textPrimary }]}>
                  {formData.scheduledStart.toLocaleDateString()}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.dateTimeButton,
                  {
                    borderColor: colors.border,
                    borderRadius: radius.xl,
                  },
                ]}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={{ fontSize: 16 }}>🕐</Text>
                <Text style={[styles.dateTimeText, { color: colors.textPrimary }]}>
                  {formData.scheduledStart.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </TouchableOpacity>

              {/* iOS inline pickers */}
              {Platform.OS === "ios" && showDatePicker && (
                <View style={styles.pickerContainer}>
                  <DateTimePicker
                    value={formData.scheduledStart}
                    mode="date"
                    display="spinner"
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                  />
                  <TouchableOpacity
                    style={[
                      styles.pickerDone,
                      {
                        backgroundColor: colors.primary.main,
                        borderRadius: radius.button,
                      },
                    ]}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}

              {Platform.OS === "ios" && showTimePicker && (
                <View style={styles.pickerContainer}>
                  <DateTimePicker
                    value={formData.scheduledStart}
                    mode="time"
                    display="spinner"
                    onChange={handleTimeChange}
                  />
                  <TouchableOpacity
                    style={[
                      styles.pickerDone,
                      {
                        backgroundColor: colors.primary.main,
                        borderRadius: radius.button,
                      },
                    ]}
                    onPress={() => setShowTimePicker(false)}
                  >
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Android modal pickers */}
          {Platform.OS === "android" && showDatePicker && (
            <DateTimePicker
              value={formData.scheduledStart}
              mode="date"
              display="default"
              onChange={handleDateChange}
              minimumDate={new Date()}
            />
          )}
          {Platform.OS === "android" && showTimePicker && (
            <DateTimePicker
              value={formData.scheduledStart}
              mode="time"
              display="default"
              onChange={handleTimeChange}
            />
          )}
        </View>

        {/* Win Condition (social only) */}
        {mode === "social" && (
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Win Condition</Text>
            <View style={styles.winList}>
              {WIN_CONDITIONS.map((w) => {
                const selected = formData.winCondition === w.id;
                return (
                  <TouchableOpacity
                    key={w.id}
                    onPress={() => update({ winCondition: w.id })}
                    activeOpacity={0.7}
                    style={[
                      styles.winOption,
                      {
                        borderRadius: radius.xl,
                        borderColor: selected ? colors.primary.main : colors.border,
                        backgroundColor: selected ? colors.primary.subtle : "transparent",
                      },
                    ]}
                  >
                    <TrophyIcon
                      size={20}
                      color={selected ? colors.primary.main : colors.textMuted}
                    />
                    <View style={styles.winText}>
                      <Text style={[styles.winLabel, { color: colors.textPrimary }]}>
                        {w.label}
                      </Text>
                      <Text style={[styles.winDesc, { color: colors.textSecondary }]}>
                        {w.desc}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  card: {
    padding: 16,
    gap: 16,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  goalRow: {
    flexDirection: "row",
    gap: 8,
  },
  goalInput: {
    flex: 1,
  },
  unitBadge: {
    paddingHorizontal: 16,
    justifyContent: "center",
    minWidth: 60,
    alignItems: "center",
  },
  unitText: {
    fontSize: 14,
    fontWeight: "500",
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  hintText: {
    fontSize: 13,
    fontWeight: "400",
  },
  durationGrid: {
    flexDirection: "row",
    gap: 8,
  },
  durationChip: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 2,
    alignItems: "center",
  },
  durationText: {
    fontSize: 13,
  },
  winList: {
    gap: 8,
  },
  winOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderWidth: 2,
    gap: 12,
  },
  winText: {
    flex: 1,
  },
  winLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  winDesc: {
    fontSize: 13,
    fontWeight: "400",
    marginTop: 1,
  },
  startToggle: {
    flexDirection: "row",
    padding: 4,
  },
  startOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  startOptionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  schedulePicker: {
    padding: 12,
    marginTop: 8,
    gap: 8,
  },
  dateTimeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
  },
  dateTimeText: {
    fontSize: 16,
    fontWeight: "500",
  },
  pickerContainer: {
    marginTop: 8,
    alignItems: "center",
  },
  pickerDone: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    marginTop: 4,
  },
  pickerDoneText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
