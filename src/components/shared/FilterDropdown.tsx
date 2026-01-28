// src/components/shared/FilterDropdown.tsx
// ============================================
// Filter Dropdown Component
// ============================================
// Horizontal scrollable filter pills for selecting options.
// Used for challenge type filters, status filters, etc.
//
// Usage:
//   <FilterDropdown
//     options={[{ id: 'all', label: 'All' }, { id: 'steps', label: 'Steps' }]}
//     selected="all"
//     onSelect={(id) => setFilter(id)}
//   />

import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { useTheme } from "@/constants/theme";

// =============================================================================
// TYPES
// =============================================================================

export interface FilterOption {
  /** Unique identifier */
  id: string;

  /** Display label */
  label: string;

  /** Optional icon component */
  icon?: React.ComponentType<{ size: number; color: string }>;

  /** Optional count badge */
  count?: number;
}

export interface FilterDropdownProps {
  /** Available filter options */
  options: FilterOption[];

  /** Currently selected option ID */
  selected: string;

  /** Callback when selection changes */
  onSelect: (id: string) => void;

  /** Allow multiple selections (default: false) */
  multiple?: boolean;

  /** Multiple selected IDs (when multiple=true) */
  selectedMultiple?: string[];

  /** Callback for multiple selections */
  onSelectMultiple?: (ids: string[]) => void;

  /** Container style */
  style?: ViewStyle;

  /** Content container style */
  contentStyle?: ViewStyle;

  /** Test ID prefix */
  testID?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function FilterDropdown({
  options,
  selected,
  onSelect,
  multiple = false,
  selectedMultiple = [],
  onSelectMultiple,
  style,
  contentStyle,
  testID = "filter-dropdown",
}: FilterDropdownProps) {
  const { colors, typography, spacing, radius } = useTheme();

  const handlePress = (id: string) => {
    if (multiple && onSelectMultiple) {
      const newSelection = selectedMultiple.includes(id)
        ? selectedMultiple.filter((s) => s !== id)
        : [...selectedMultiple, id];
      onSelectMultiple(newSelection);
    } else {
      onSelect(id);
    }
  };

  const isSelected = (id: string) => {
    if (multiple) {
      return selectedMultiple.includes(id);
    }
    return selected === id;
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: spacing.lg, gap: spacing.sm },
          contentStyle,
        ]}
      >
        {options.map((option) => {
          const active = isSelected(option.id);
          const IconComponent = option.icon;

          return (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.pill,
                {
                  backgroundColor: active
                    ? colors.primary.main
                    : colors.surface,
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderWidth: 1,
                  borderColor: active ? colors.primary.main : colors.border,
                },
              ]}
              onPress={() => handlePress(option.id)}
              activeOpacity={0.7}
              testID={`${testID}-option-${option.id}`}
            >
              {IconComponent && (
                <IconComponent
                  size={16}
                  color={
                    active ? colors.primary.contrast : colors.textSecondary
                  }
                />
              )}

              <Text
                style={[
                  styles.pillText,
                  {
                    color: active
                      ? colors.primary.contrast
                      : colors.textPrimary,
                    fontSize: typography.fontSize.sm,
                    fontWeight: active
                      ? (typography.fontWeight.semibold as any)
                      : (typography.fontWeight.medium as any),
                    marginLeft: IconComponent ? spacing.xs : 0,
                  },
                ]}
              >
                {option.label}
              </Text>

              {option.count !== undefined && option.count > 0 && (
                <View
                  style={[
                    styles.countBadge,
                    {
                      backgroundColor: active
                        ? colors.primary.contrast
                        : colors.primary.subtle,
                      borderRadius: radius.full,
                      marginLeft: spacing.xs,
                      paddingHorizontal: spacing.xs,
                      minWidth: 18,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.countText,
                      {
                        color: active
                          ? colors.primary.main
                          : colors.primary.main,
                        fontSize: typography.fontSize.xs,
                        fontWeight: typography.fontWeight.semibold as any,
                      },
                    ]}
                  >
                    {option.count > 99 ? "99+" : option.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// =============================================================================
// PRESET FILTER CONFIGURATIONS
// =============================================================================

export const CHALLENGE_TYPE_FILTERS: FilterOption[] = [
  { id: "all", label: "All" },
  { id: "steps", label: "Steps" },
  { id: "active_minutes", label: "Active Minutes" },
  { id: "workouts", label: "Workouts" },
  { id: "distance", label: "Distance" },
  { id: "calories", label: "Calories" },
];

export const CHALLENGE_STATUS_FILTERS: FilterOption[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
];

export const TIME_RANGE_FILTERS: FilterOption[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "all", label: "All Time" },
];

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    // Container has no height restriction to allow pill wrapping if needed
  },
  scrollContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    textAlign: "center",
  },
  countBadge: {
    alignItems: "center",
    justifyContent: "center",
    height: 18,
  },
  countText: {
    textAlign: "center",
  },
});

export default FilterDropdown;
