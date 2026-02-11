// src/components/create-challenge/StepWorkoutPicker.tsx
// Step 2b: Select which workout types are allowed for this challenge
// Only shown when challengeType === 'workouts'

import React, { useMemo, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import { CheckCircleIcon } from "react-native-heroicons/solid";
import {
  WORKOUT_TYPE_CATALOG,
  type StepWorkoutPickerProps,
  type WorkoutTypeCatalogEntry,
} from "./types";
import { TestIDs } from "@/constants/testIDs";

// =============================================================================
// CATEGORY CONFIG
// =============================================================================

const CATEGORIES: {
  id: string;
  label: string;
  emoji: string;
}[] = [
  { id: "cardio", label: "Cardio", emoji: "🏃" },
  { id: "strength", label: "Strength & Conditioning", emoji: "💪" },
  { id: "flexibility", label: "Flexibility & Mind/Body", emoji: "🧘" },
  { id: "sports", label: "Sports", emoji: "⚽" },
];

// =============================================================================
// MULTIPLIER BADGE
// =============================================================================

function MultiplierBadge({ multiplier, color }: { multiplier: number; color: string }) {
  if (multiplier === 1.0) return null;

  const label = multiplier > 1.0 ? `${multiplier}×` : `${multiplier}×`;
  return <Text style={[styles.multiplierBadge, { color }]}>{label}</Text>;
}

// =============================================================================
// WORKOUT CHIP
// =============================================================================

function WorkoutChip({
  entry,
  selected,
  onToggle,
}: {
  entry: WorkoutTypeCatalogEntry;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const { colors, radius } = useAppTheme();

  return (
    <TouchableOpacity
      onPress={() => onToggle(entry.id)}
      activeOpacity={0.7}
      testID={TestIDs.createWizard.workoutChip(entry.id)}
      style={[
        styles.chip,
        {
          borderRadius: radius.xl,
          borderColor: selected ? colors.primary.main : colors.border,
          backgroundColor: selected ? colors.primary.subtle : "transparent",
        },
      ]}
    >
      {selected && <CheckCircleIcon size={18} color={colors.primary.main} />}
      <Text
        style={[
          styles.chipText,
          {
            color: selected ? colors.primary.dark : colors.textPrimary,
            fontWeight: selected ? "600" : "500",
          },
        ]}
      >
        {entry.name}
      </Text>
      <MultiplierBadge
        multiplier={entry.multiplier}
        color={selected ? colors.primary.main : colors.textMuted}
      />
    </TouchableOpacity>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export function StepWorkoutPicker({
  selectedWorkoutTypes,
  setSelectedWorkoutTypes,
  onNext,
  onBack,
}: StepWorkoutPickerProps) {
  const { colors, radius } = useAppTheme();

  // Group workout types by category
  const grouped = useMemo(() => {
    const map = new Map<string, WorkoutTypeCatalogEntry[]>();
    for (const cat of CATEGORIES) {
      map.set(cat.id, []);
    }
    for (const entry of WORKOUT_TYPE_CATALOG) {
      const list = map.get(entry.category);
      if (list) list.push(entry);
    }
    return map;
  }, []);

  const allTypeIds = useMemo(() => WORKOUT_TYPE_CATALOG.map((e) => e.id), []);

  const allSelected = selectedWorkoutTypes.length === allTypeIds.length;

  const handleToggle = useCallback(
    (id: string) => {
      if (selectedWorkoutTypes.includes(id)) {
        setSelectedWorkoutTypes(selectedWorkoutTypes.filter((t) => t !== id));
      } else {
        setSelectedWorkoutTypes([...selectedWorkoutTypes, id]);
      }
    },
    [selectedWorkoutTypes, setSelectedWorkoutTypes],
  );

  const handleToggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedWorkoutTypes([]);
    } else {
      setSelectedWorkoutTypes([...allTypeIds]);
    }
  }, [allSelected, allTypeIds, setSelectedWorkoutTypes]);

  const handleSelectCategory = useCallback(
    (categoryId: string) => {
      const categoryTypes = grouped.get(categoryId) || [];
      const categoryIds = categoryTypes.map((e) => e.id);
      const allCatSelected = categoryIds.every((id) => selectedWorkoutTypes.includes(id));

      if (allCatSelected) {
        // Deselect all in this category
        setSelectedWorkoutTypes(selectedWorkoutTypes.filter((t) => !categoryIds.includes(t)));
      } else {
        // Select all in this category
        const newSet = new Set([...selectedWorkoutTypes, ...categoryIds]);
        setSelectedWorkoutTypes(Array.from(newSet));
      }
    },
    [grouped, selectedWorkoutTypes, setSelectedWorkoutTypes],
  );

  return (
    <View style={styles.container} testID={TestIDs.createWizard.stepWorkoutPicker}>
      <Text style={[styles.heading, { color: colors.textPrimary }]}>Which exercises count?</Text>
      <Text style={[styles.subheading, { color: colors.textSecondary }]}>
        Select the workout types allowed in this challenge. Different types earn different point
        multipliers.
      </Text>

      {/* Select All Toggle */}
      <Pressable
        onPress={handleToggleAll}
        testID={TestIDs.createWizard.workoutSelectAll}
        style={[
          styles.selectAllRow,
          {
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
          },
        ]}
      >
        <View
          style={[
            styles.selectAllCheck,
            {
              borderColor: allSelected ? colors.primary.main : colors.border,
              backgroundColor: allSelected ? colors.primary.main : "transparent",
              borderRadius: 6,
            },
          ]}
        >
          {allSelected && <CheckCircleIcon size={16} color="#FFFFFF" />}
        </View>
        <Text style={[styles.selectAllText, { color: colors.textPrimary }]}>All Workout Types</Text>
        <Text style={[styles.countBadge, { color: colors.textSecondary }]}>
          {selectedWorkoutTypes.length}/{allTypeIds.length}
        </Text>
      </Pressable>

      {/* Category Groups */}
      {CATEGORIES.map((cat) => {
        const entries = grouped.get(cat.id) || [];
        if (entries.length === 0) return null;

        const catIds = entries.map((e) => e.id);
        const catAllSelected = catIds.every((id) => selectedWorkoutTypes.includes(id));
        const catSomeSelected =
          !catAllSelected && catIds.some((id) => selectedWorkoutTypes.includes(id));

        return (
          <View
            key={cat.id}
            style={[
              styles.categoryCard,
              {
                backgroundColor: colors.surface,
                borderRadius: radius["2xl"],
              },
            ]}
          >
            {/* Category Header */}
            <TouchableOpacity
              onPress={() => handleSelectCategory(cat.id)}
              activeOpacity={0.7}
              style={styles.categoryHeader}
              testID={TestIDs.createWizard.workoutCategory(cat.id)}
            >
              <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
              <Text style={[styles.categoryLabel, { color: colors.textPrimary }]}>{cat.label}</Text>
              <Text style={[styles.categoryCount, { color: colors.textMuted }]}>
                {catIds.filter((id) => selectedWorkoutTypes.includes(id)).length}/{catIds.length}
              </Text>
            </TouchableOpacity>

            {/* Workout Chips */}
            <View style={styles.chipGrid}>
              {entries.map((entry) => (
                <WorkoutChip
                  key={entry.id}
                  entry={entry}
                  selected={selectedWorkoutTypes.includes(entry.id)}
                  onToggle={handleToggle}
                />
              ))}
            </View>
          </View>
        );
      })}

      {/* Hint */}
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        💡 Selecting no types means all types are allowed
      </Text>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  heading: {
    fontSize: 18,
    fontWeight: "600",
  },
  subheading: {
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
    marginBottom: 4,
  },
  selectAllRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  selectAllCheck: {
    width: 24,
    height: 24,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  selectAllText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  countBadge: {
    fontSize: 13,
    fontWeight: "500",
  },
  categoryCard: {
    padding: 16,
    gap: 12,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryEmoji: {
    fontSize: 18,
  },
  categoryLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  categoryCount: {
    fontSize: 13,
    fontWeight: "500",
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    gap: 6,
  },
  chipText: {
    fontSize: 14,
  },
  multiplierBadge: {
    fontSize: 11,
    fontWeight: "700",
  },
  hint: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
    fontWeight: "400",
  },
});
