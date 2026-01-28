// __tests__/components/shared/EmptyState.test.tsx
// ============================================
// EmptyState Component Tests
// ============================================

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { EmptyState, EmptyStateVariant } from "@/components/shared/EmptyState";

// Mock the theme hook
jest.mock("@/constants/theme", () => ({
  useTheme: () => ({
    colors: {
      primary: {
        main: "#10B981",
        subtle: "#D1FAE5",
        contrast: "#FFFFFF",
      },
      textPrimary: "#111827",
      textSecondary: "#6B7280",
    },
    typography: {
      fontSize: {
        sm: 14,
        base: 16,
        lg: 18,
      },
      fontWeight: {
        medium: "500",
        semibold: "600",
      },
      lineHeight: {
        relaxed: 1.625,
      },
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 20,
      "3xl": 32,
    },
    radius: {
      button: 12,
      full: 9999,
    },
  }),
}));

// Mock heroicons
jest.mock("react-native-heroicons/outline", () => ({
  TrophyIcon: () => "TrophyIcon",
  UserGroupIcon: () => "UserGroupIcon",
  BellIcon: () => "BellIcon",
  MagnifyingGlassIcon: () => "MagnifyingGlassIcon",
  WifiIcon: () => "WifiIcon",
  ExclamationTriangleIcon: () => "ExclamationTriangleIcon",
  HeartIcon: () => "HeartIcon",
  ClipboardDocumentListIcon: () => "ClipboardDocumentListIcon",
  SparklesIcon: () => "SparklesIcon",
}));

describe("EmptyState", () => {
  describe("rendering", () => {
    it("renders with no-challenges variant", () => {
      const { getByTestId, getByText } = render(
        <EmptyState variant="no-challenges" />,
      );

      expect(getByTestId("empty-state-no-challenges")).toBeTruthy();
      expect(getByText("No Challenges Yet")).toBeTruthy();
      expect(
        getByText("Create your first challenge and invite friends to compete!"),
      ).toBeTruthy();
    });

    it("renders with no-friends variant", () => {
      const { getByText } = render(<EmptyState variant="no-friends" />);

      expect(getByText("No Friends Yet")).toBeTruthy();
      expect(
        getByText("Add friends to challenge them to fitness competitions!"),
      ).toBeTruthy();
    });

    it("renders with offline variant", () => {
      const { getByText } = render(<EmptyState variant="offline" />);

      expect(getByText("You're Offline")).toBeTruthy();
      expect(
        getByText("Check your internet connection and try again."),
      ).toBeTruthy();
    });

    it("renders with error variant", () => {
      const { getByText } = render(<EmptyState variant="error" />);

      expect(getByText("Something Went Wrong")).toBeTruthy();
    });

    it("renders with no-health-data variant", () => {
      const { getByText } = render(<EmptyState variant="no-health-data" />);

      expect(getByText("No Health Data")).toBeTruthy();
      expect(
        getByText(
          "Connect to Apple Health to sync your fitness data automatically.",
        ),
      ).toBeTruthy();
    });
  });

  describe("custom content", () => {
    it("allows custom title", () => {
      const { getByText, queryByText } = render(
        <EmptyState variant="no-challenges" title="Custom Title" />,
      );

      expect(getByText("Custom Title")).toBeTruthy();
      expect(queryByText("No Challenges Yet")).toBeNull();
    });

    it("allows custom message", () => {
      const { getByText, queryByText } = render(
        <EmptyState variant="no-challenges" message="Custom message here" />,
      );

      expect(getByText("Custom message here")).toBeTruthy();
      expect(
        queryByText(
          "Create your first challenge and invite friends to compete!",
        ),
      ).toBeNull();
    });

    it("allows custom testID", () => {
      const { getByTestId } = render(
        <EmptyState variant="no-challenges" testID="custom-empty-state" />,
      );

      expect(getByTestId("custom-empty-state")).toBeTruthy();
    });
  });

  describe("actions", () => {
    it("renders primary action button when provided", () => {
      const onAction = jest.fn();
      const { getByText } = render(
        <EmptyState
          variant="no-challenges"
          actionText="Create Challenge"
          onAction={onAction}
        />,
      );

      const button = getByText("Create Challenge");
      expect(button).toBeTruthy();
    });

    it("calls onAction when primary button is pressed", () => {
      const onAction = jest.fn();
      const { getByTestId } = render(
        <EmptyState
          variant="no-challenges"
          actionText="Create"
          onAction={onAction}
        />,
      );

      fireEvent.press(getByTestId("empty-state-no-challenges-action"));
      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it("renders secondary action when provided", () => {
      const onSecondary = jest.fn();
      const { getByText } = render(
        <EmptyState
          variant="no-challenges"
          secondaryActionText="Learn More"
          onSecondaryAction={onSecondary}
        />,
      );

      expect(getByText("Learn More")).toBeTruthy();
    });

    it("calls onSecondaryAction when secondary button is pressed", () => {
      const onSecondary = jest.fn();
      const { getByTestId } = render(
        <EmptyState
          variant="no-challenges"
          secondaryActionText="Learn More"
          onSecondaryAction={onSecondary}
        />,
      );

      fireEvent.press(
        getByTestId("empty-state-no-challenges-secondary-action"),
      );
      expect(onSecondary).toHaveBeenCalledTimes(1);
    });

    it("uses default action text from variant config", () => {
      const onAction = jest.fn();
      const { getByText } = render(
        <EmptyState variant="no-challenges" onAction={onAction} />,
      );

      // Default action text for no-challenges is "Create Challenge"
      expect(getByText("Create Challenge")).toBeTruthy();
    });

    it("does not render action button without onAction", () => {
      const { queryByTestId } = render(
        <EmptyState variant="no-challenges" actionText="Create" />,
      );

      expect(queryByTestId("empty-state-no-challenges-action")).toBeNull();
    });
  });

  describe("all variants", () => {
    const variants: EmptyStateVariant[] = [
      "no-challenges",
      "no-active-challenges",
      "no-friends",
      "no-friend-requests",
      "no-activity",
      "no-notifications",
      "no-search-results",
      "offline",
      "error",
      "no-health-data",
    ];

    variants.forEach((variant) => {
      it(`renders ${variant} variant without crashing`, () => {
        const { getByTestId } = render(<EmptyState variant={variant} />);
        expect(getByTestId(`empty-state-${variant}`)).toBeTruthy();
      });
    });
  });
});
