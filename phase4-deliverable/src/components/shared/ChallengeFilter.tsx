// src/components/shared/ChallengeFilter.tsx
// Challenge filter dropdown with icons
// Design System - Based on prototype

import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Animated,
} from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import {
  FunnelIcon,
  TrophyIcon,
  ClockIcon,
  CheckIcon,
} from "react-native-heroicons/outline";
import {
  FootprintsIcon,
  DumbbellIcon,
  RunningIcon,
} from "@/components/icons/ActivityIcons";

// Activity icons mapping
const FilterIcons: Record<
  string,
  React.ComponentType<{ size: number; color: string }>
> = {
  all: TrophyIcon,
  ending: ClockIcon,
  steps: ({ size, color }) => <FootprintsIcon size={size} color={color} />,
  workouts: ({ size, color }) => <DumbbellIcon size={size} color={color} />,
  workout_points: ({ size, color }) => (
    <DumbbellIcon size={size} color={color} />
  ),
  distance: ({ size, color }) => <RunningIcon size={size} color={color} />,
  active_minutes: ClockIcon,
};

export type ChallengeFilterType =
  | "all"
  | "ending"
  | "steps"
  | "workouts"
  | "workout_points"
  | "distance"
  | "active_minutes";

export interface FilterOption {
  id: ChallengeFilterType;
  label: string;
}

export const CHALLENGE_FILTERS: FilterOption[] = [
  { id: "all", label: "All" },
  { id: "ending", label: "Ending Soon" },
  { id: "steps", label: "Steps" },
  { id: "workouts", label: "Workouts" },
  { id: "distance", label: "Distance" },
];

export interface ChallengeFilterProps {
  activeFilter: ChallengeFilterType;
  onFilterChange: (filter: ChallengeFilterType) => void;
  filters?: FilterOption[];
}

export function ChallengeFilter({
  activeFilter,
  onFilterChange,
  filters = CHALLENGE_FILTERS,
}: ChallengeFilterProps) {
  const { colors, spacing, radius } = useAppTheme();
  const [isOpen, setIsOpen] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  const currentFilter =
    filters.find((f) => f.id === activeFilter) || filters[0];
  const isFiltered = activeFilter !== "all";

  const openDropdown = () => {
    setIsOpen(true);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const closeDropdown = () => {
    Animated.timing(scaleAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setIsOpen(false);
    });
  };

  const handleSelect = (filter: ChallengeFilterType) => {
    onFilterChange(filter);
    closeDropdown();
  };

  const getIconComponent = (filterId: string) => {
    return FilterIcons[filterId] || TrophyIcon;
  };

  return (
    <View style={styles.container}>
      {/* Filter Button */}
      <TouchableOpacity
        onPress={openDropdown}
        style={[
          styles.filterButton,
          {
            backgroundColor: isFiltered ? colors.primary.subtle : "transparent",
            borderRadius: radius.sm,
          },
        ]}
        activeOpacity={0.7}
      >
        <FunnelIcon
          size={14}
          color={isFiltered ? colors.primary.main : colors.textMuted}
        />
      </TouchableOpacity>

      {/* Dropdown Modal */}
      <Modal
        visible={isOpen}
        transparent
        animationType="none"
        onRequestClose={closeDropdown}
      >
        <Pressable style={styles.backdrop} onPress={closeDropdown}>
          <Animated.View
            style={[
              styles.dropdown,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                borderColor: colors.border,
                transform: [
                  { scale: scaleAnim },
                  {
                    translateY: scaleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-20, 0],
                    }),
                  },
                ],
                opacity: scaleAnim,
              },
            ]}
          >
            <Text
              style={[
                styles.dropdownTitle,
                { color: colors.textSecondary, marginBottom: spacing.sm },
              ]}
            >
              FILTER BY
            </Text>

            {filters.map((filter) => {
              const IconComponent = getIconComponent(filter.id);
              const isActive = activeFilter === filter.id;

              return (
                <TouchableOpacity
                  key={filter.id}
                  onPress={() => handleSelect(filter.id)}
                  style={[
                    styles.filterOption,
                    {
                      backgroundColor: isActive
                        ? colors.primary.subtle
                        : "transparent",
                      borderRadius: radius.md,
                      paddingVertical: spacing.sm + 2,
                      paddingHorizontal: spacing.md,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={styles.filterOptionContent}>
                    <IconComponent
                      size={18}
                      color={
                        isActive ? colors.primary.main : colors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.filterLabel,
                        {
                          color: isActive
                            ? colors.primary.main
                            : colors.textPrimary,
                        },
                      ]}
                    >
                      {filter.label}
                    </Text>
                  </View>
                  {isActive && (
                    <CheckIcon size={16} color={colors.primary.main} />
                  )}
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

// Active Filter Badge - shows when filter is applied
export interface ActiveFilterBadgeProps {
  filter: ChallengeFilterType;
  label: string;
  onClear: () => void;
}

export function ActiveFilterBadge({
  filter,
  label,
  onClear,
}: ActiveFilterBadgeProps) {
  const { colors, spacing, radius } = useAppTheme();

  if (filter === "all") return null;

  return (
    <View style={[styles.badgeContainer, { marginBottom: spacing.sm }]}>
      <Text style={[styles.badgePrefix, { color: colors.textSecondary }]}>
        Showing:
      </Text>
      <View
        style={[
          styles.badge,
          {
            backgroundColor: colors.primary.subtle,
            borderRadius: radius.full,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
          },
        ]}
      >
        <Text style={[styles.badgeText, { color: colors.primary.main }]}>
          {label}
        </Text>
      </View>
      <TouchableOpacity onPress={onClear}>
        <Text style={[styles.clearText, { color: colors.textMuted }]}>
          Clear
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  filterButton: {
    padding: 6,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  dropdown: {
    width: 200,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
  },
  dropdownTitle: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  filterOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 2,
  },
  filterOptionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  filterLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  // Badge styles
  badgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badgePrefix: {
    fontSize: 12,
  },
  badge: {},
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  clearText: {
    fontSize: 12,
  },
});

export default ChallengeFilter;
