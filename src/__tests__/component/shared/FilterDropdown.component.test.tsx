// __tests__/components/shared/FilterDropdown.test.tsx
// ============================================
// FilterDropdown Component Tests
// ============================================

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import {
  FilterDropdown,
  FilterOption,
  CHALLENGE_TYPE_FILTERS,
  CHALLENGE_STATUS_FILTERS,
} from "@/components/shared/FilterDropdown";

// Mock the theme hook
jest.mock("@/constants/theme", () => ({
  useTheme: () => ({
    colors: {
      primary: {
        main: "#10B981",
        subtle: "#D1FAE5",
        contrast: "#FFFFFF",
      },
      surface: "#FFFFFF",
      border: "#E5E7EB",
      textPrimary: "#111827",
      textSecondary: "#6B7280",
    },
    typography: {
      fontSize: {
        xs: 12,
        sm: 14,
      },
      fontWeight: {
        medium: "500",
        semibold: "600",
      },
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
    },
    radius: {
      full: 9999,
    },
  }),
}));

describe("FilterDropdown", () => {
  const defaultOptions: FilterOption[] = [
    { id: "all", label: "All" },
    { id: "steps", label: "Steps" },
    { id: "workouts", label: "Workouts" },
  ];

  describe("rendering", () => {
    it("renders all options", () => {
      const { getByText } = render(
        <FilterDropdown
          options={defaultOptions}
          selected="all"
          onSelect={jest.fn()}
        />,
      );

      expect(getByText("All")).toBeTruthy();
      expect(getByText("Steps")).toBeTruthy();
      expect(getByText("Workouts")).toBeTruthy();
    });

    it("renders with custom testID", () => {
      const { getByTestId } = render(
        <FilterDropdown
          options={defaultOptions}
          selected="all"
          onSelect={jest.fn()}
          testID="custom-filter"
        />,
      );

      expect(getByTestId("custom-filter")).toBeTruthy();
    });

    it("renders option with testID", () => {
      const { getByTestId } = render(
        <FilterDropdown
          options={defaultOptions}
          selected="all"
          onSelect={jest.fn()}
          testID="filter"
        />,
      );

      expect(getByTestId("filter-option-all")).toBeTruthy();
      expect(getByTestId("filter-option-steps")).toBeTruthy();
    });
  });

  describe("selection", () => {
    it("calls onSelect when option is pressed", () => {
      const onSelect = jest.fn();
      const { getByTestId } = render(
        <FilterDropdown
          options={defaultOptions}
          selected="all"
          onSelect={onSelect}
        />,
      );

      fireEvent.press(getByTestId("filter-dropdown-option-steps"));
      expect(onSelect).toHaveBeenCalledWith("steps");
    });

    it("calls onSelect with correct id when different option is pressed", () => {
      const onSelect = jest.fn();
      const { getByTestId } = render(
        <FilterDropdown
          options={defaultOptions}
          selected="steps"
          onSelect={onSelect}
        />,
      );

      fireEvent.press(getByTestId("filter-dropdown-option-workouts"));
      expect(onSelect).toHaveBeenCalledWith("workouts");
    });
  });

  describe("multiple selection", () => {
    it("handles multiple selection mode", () => {
      const onSelectMultiple = jest.fn();
      const { getByTestId } = render(
        <FilterDropdown
          options={defaultOptions}
          selected=""
          onSelect={jest.fn()}
          multiple
          selectedMultiple={["all"]}
          onSelectMultiple={onSelectMultiple}
        />,
      );

      fireEvent.press(getByTestId("filter-dropdown-option-steps"));
      expect(onSelectMultiple).toHaveBeenCalledWith(["all", "steps"]);
    });

    it("removes item from selection when already selected", () => {
      const onSelectMultiple = jest.fn();
      const { getByTestId } = render(
        <FilterDropdown
          options={defaultOptions}
          selected=""
          onSelect={jest.fn()}
          multiple
          selectedMultiple={["all", "steps"]}
          onSelectMultiple={onSelectMultiple}
        />,
      );

      fireEvent.press(getByTestId("filter-dropdown-option-steps"));
      expect(onSelectMultiple).toHaveBeenCalledWith(["all"]);
    });
  });

  describe("count badges", () => {
    it("renders count badge when option has count", () => {
      const optionsWithCount: FilterOption[] = [
        { id: "active", label: "Active", count: 5 },
        { id: "pending", label: "Pending", count: 0 },
      ];

      const { getByText, queryByText } = render(
        <FilterDropdown
          options={optionsWithCount}
          selected="active"
          onSelect={jest.fn()}
        />,
      );

      expect(getByText("5")).toBeTruthy();
      // Count of 0 should not show badge (based on component logic)
      expect(queryByText("0")).toBeNull();
    });

    it("shows 99+ for counts over 99", () => {
      const optionsWithCount: FilterOption[] = [
        { id: "all", label: "All", count: 150 },
      ];

      const { getByText } = render(
        <FilterDropdown
          options={optionsWithCount}
          selected="all"
          onSelect={jest.fn()}
        />,
      );

      expect(getByText("99+")).toBeTruthy();
    });
  });

  describe("preset configurations", () => {
    it("CHALLENGE_TYPE_FILTERS has expected options", () => {
      expect(CHALLENGE_TYPE_FILTERS).toHaveLength(6);
      expect(CHALLENGE_TYPE_FILTERS.map((f) => f.id)).toEqual([
        "all",
        "steps",
        "active_minutes",
        "workouts",
        "distance",
        "calories",
      ]);
    });

    it("CHALLENGE_STATUS_FILTERS has expected options", () => {
      expect(CHALLENGE_STATUS_FILTERS).toHaveLength(4);
      expect(CHALLENGE_STATUS_FILTERS.map((f) => f.id)).toEqual([
        "all",
        "active",
        "upcoming",
        "completed",
      ]);
    });

    it("renders CHALLENGE_TYPE_FILTERS correctly", () => {
      const { getByText } = render(
        <FilterDropdown
          options={CHALLENGE_TYPE_FILTERS}
          selected="all"
          onSelect={jest.fn()}
        />,
      );

      expect(getByText("All")).toBeTruthy();
      expect(getByText("Steps")).toBeTruthy();
      expect(getByText("Active Minutes")).toBeTruthy();
      expect(getByText("Calories")).toBeTruthy();
    });
  });
});
