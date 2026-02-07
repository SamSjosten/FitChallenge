// src/hooks/useChallengeFilters.ts
// Challenge filtering hook for Home Screen
//
// Handles:
// - Filter state management
// - Challenge filtering logic
// - Filter label calculation
// - Layout animation for filter changes

import { useState, useMemo, useCallback } from "react";
import { LayoutAnimation, Platform, UIManager } from "react-native";
import { CHALLENGE_FILTERS, type ChallengeFilterType } from "@/components/shared";
import { getDaysRemaining } from "@/lib/serverTime";

// Enable LayoutAnimation on Android (idempotent)
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Type for challenge data (minimal interface for filtering)
interface FilterableChallenge {
  id: string;
  challenge_type: string;
  end_date: string;
}

export interface ChallengeFiltersResult<T extends FilterableChallenge> {
  // State
  activeFilter: ChallengeFilterType;
  currentFilterLabel: string;

  // Filtered data
  filteredChallenges: T[];

  // Actions
  handleFilterChange: (filter: ChallengeFilterType) => void;
  handleClearFilter: () => void;

  // Derived
  hasActiveFilter: boolean;
}

export function useChallengeFilters<T extends FilterableChallenge>(
  challenges: T[] | undefined,
): ChallengeFiltersResult<T> {
  const [activeFilter, setActiveFilter] = useState<ChallengeFilterType>("all");

  // Filter challenges based on selected filter
  const filteredChallenges = useMemo(() => {
    if (!challenges) return [];

    let filtered = [...challenges];

    switch (activeFilter) {
      case "ending":
        // Sort by days left, filter to those ending within 5 days
        filtered = filtered
          .filter((c) => {
            const daysLeft = getDaysRemaining(c.end_date);
            return daysLeft <= 5 && daysLeft >= 0;
          })
          .sort(
            (a, b) =>
              new Date(a.end_date).getTime() - new Date(b.end_date).getTime(),
          );
        break;
      case "steps":
        filtered = filtered.filter((c) => c.challenge_type === "steps");
        break;
      case "workouts":
      case "workout_points":
        filtered = filtered.filter((c) => c.challenge_type === "workouts");
        break;
      case "distance":
        filtered = filtered.filter((c) => c.challenge_type === "distance");
        break;
      case "active_minutes":
        filtered = filtered.filter(
          (c) => c.challenge_type === "active_minutes",
        );
        break;
      default:
        // "all" - no filter
        break;
    }

    return filtered;
  }, [challenges, activeFilter]);

  // Get current filter label
  const currentFilterLabel = useMemo(() => {
    return CHALLENGE_FILTERS.find((f) => f.id === activeFilter)?.label || "All";
  }, [activeFilter]);

  // Handle filter change with animation
  const handleFilterChange = useCallback((filter: ChallengeFilterType) => {
    LayoutAnimation.configureNext({
      duration: 200,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
    });
    setActiveFilter(filter);
  }, []);

  // Clear filter (reset to "all")
  const handleClearFilter = useCallback(() => {
    handleFilterChange("all");
  }, [handleFilterChange]);

  return {
    activeFilter,
    currentFilterLabel,
    filteredChallenges,
    handleFilterChange,
    handleClearFilter,
    hasActiveFilter: activeFilter !== "all",
  };
}
