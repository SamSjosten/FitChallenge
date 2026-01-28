// __tests__/components/shared/StreakBanner.component.test.tsx
// ============================================
// StreakBanner Component Unit Tests
// ============================================

import React from "react";
import { render, fireEvent, screen, act } from "@testing-library/react-native";
import {
  StreakBanner,
  StreakMilestoneBanner,
} from "@/components/shared/StreakBanner";

// NOTE: react-native-reanimated is mocked in jest.setup.ts

// Mock react-native-gesture-handler with chainable methods
jest.mock("react-native-gesture-handler", () => {
  const createChainableGesture = () => {
    const gesture: any = {};
    const methods = [
      "onStart",
      "onUpdate",
      "onEnd",
      "onFinalize",
      "enabled",
      "minDistance",
      "maxPointers",
      "minPointers",
    ];
    methods.forEach((method) => {
      gesture[method] = () => gesture;
    });
    return gesture;
  };

  return {
    GestureDetector: ({ children }: any) => children,
    GestureHandlerRootView: ({ children }: any) => children,
    Gesture: {
      Pan: () => createChainableGesture(),
      Tap: () => createChainableGesture(),
      Race: (...gestures: any[]) => createChainableGesture(),
      Simultaneous: (...gestures: any[]) => createChainableGesture(),
    },
    Directions: { RIGHT: 1, LEFT: 2, UP: 4, DOWN: 8 },
  };
});

// Mock Heroicons
jest.mock("react-native-heroicons/solid", () => ({
  FireIcon: () => "FireIcon",
  SparklesIcon: () => "SparklesIcon",
  XMarkIcon: () => "XMarkIcon",
}));

describe("StreakBanner", () => {
  describe("Rendering", () => {
    it("should render with streak count", () => {
      render(<StreakBanner streak={7} testID="streak-banner" />);

      expect(screen.getByTestId("streak-banner")).toBeTruthy();
      // Streak displays as "🔥 7"
      expect(screen.getByText(/🔥 7/)).toBeTruthy();
    });

    it("should render with testID", () => {
      render(<StreakBanner streak={5} testID="my-streak" />);

      expect(screen.getByTestId("my-streak")).toBeTruthy();
    });

    it("should display streak count with fire emoji", () => {
      render(<StreakBanner streak={5} testID="streak" />);
      expect(screen.getByText(/🔥 5/)).toBeTruthy();
    });
  });

  describe("Variants", () => {
    it("should render default variant", () => {
      render(<StreakBanner streak={5} variant="default" testID="streak" />);
      expect(screen.getByTestId("streak")).toBeTruthy();
    });

    it("should render milestone variant", () => {
      render(<StreakBanner streak={7} variant="milestone" testID="streak" />);
      expect(screen.getByTestId("streak")).toBeTruthy();
    });

    it("should render recovered variant", () => {
      render(<StreakBanner streak={1} variant="recovered" testID="streak" />);
      expect(screen.getByTestId("streak")).toBeTruthy();
    });

    it("should render broken variant", () => {
      render(<StreakBanner streak={0} variant="broken" testID="streak" />);
      expect(screen.getByTestId("streak")).toBeTruthy();
    });
  });

  describe("Custom Message", () => {
    it("should display custom message when provided", () => {
      render(
        <StreakBanner
          streak={5}
          message="Custom streak message!"
          testID="streak"
        />,
      );

      expect(screen.getByText("Custom streak message!")).toBeTruthy();
    });

    it("should display default message when not provided", () => {
      render(<StreakBanner streak={5} testID="streak" />);

      // Default message contains "streak"
      expect(screen.getByText(/streak/i)).toBeTruthy();
    });
  });

  describe("Milestone Messages", () => {
    it("should show milestone message for milestone variant", () => {
      render(<StreakBanner streak={7} variant="milestone" testID="streak" />);
      expect(screen.getByText(/milestone/i)).toBeTruthy();
    });

    it("should show recovery message for recovered variant", () => {
      render(<StreakBanner streak={3} variant="recovered" testID="streak" />);
      expect(screen.getByText(/recovered/i)).toBeTruthy();
    });

    it("should show broken message for broken variant", () => {
      render(<StreakBanner streak={0} variant="broken" testID="streak" />);
      expect(screen.getByText(/broken/i)).toBeTruthy();
    });
  });

  describe("Streak Values", () => {
    it("should handle zero streak", () => {
      render(<StreakBanner streak={0} testID="streak" />);
      // Zero shows just fire emoji
      expect(screen.getByText("🔥")).toBeTruthy();
    });

    it("should handle large streak numbers", () => {
      render(<StreakBanner streak={365} testID="streak" />);
      expect(screen.getByText(/🔥 365/)).toBeTruthy();
    });

    it("should handle single day streak", () => {
      render(<StreakBanner streak={1} testID="streak" />);
      expect(screen.getByText(/🔥 1/)).toBeTruthy();
    });
  });

  describe("Auto Dismiss", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should auto dismiss after delay when autoDismiss is true", () => {
      const onDismiss = jest.fn();
      render(
        <StreakBanner
          streak={5}
          autoDismiss
          autoDismissDelay={3000}
          onDismiss={onDismiss}
          testID="streak"
        />,
      );

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(onDismiss).toHaveBeenCalled();
    });

    it("should not auto dismiss when autoDismiss is false", () => {
      const onDismiss = jest.fn();
      render(
        <StreakBanner
          streak={5}
          autoDismiss={false}
          onDismiss={onDismiss}
          testID="streak"
        />,
      );

      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(onDismiss).not.toHaveBeenCalled();
    });

    it("should use custom autoDismissDelay", () => {
      const onDismiss = jest.fn();
      render(
        <StreakBanner
          streak={5}
          autoDismiss
          autoDismissDelay={5000}
          onDismiss={onDismiss}
          testID="streak"
        />,
      );

      // Not yet dismissed
      act(() => {
        jest.advanceTimersByTime(4000);
      });
      expect(onDismiss).not.toHaveBeenCalled();

      // Now dismissed
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(onDismiss).toHaveBeenCalled();
    });
  });
});

describe("StreakMilestoneBanner", () => {
  describe("Milestone Detection", () => {
    it("should render milestone variant for 7 day milestone", () => {
      const onDismiss = jest.fn();
      const result = StreakMilestoneBanner({ streak: 7, onDismiss });

      expect(result).not.toBeNull();
      expect(result?.props.variant).toBe("milestone");
    });

    it("should render milestone variant for 14 day milestone", () => {
      const onDismiss = jest.fn();
      const result = StreakMilestoneBanner({ streak: 14, onDismiss });

      expect(result).not.toBeNull();
      expect(result?.props.variant).toBe("milestone");
    });

    it("should render milestone variant for 30 day milestone", () => {
      const onDismiss = jest.fn();
      const result = StreakMilestoneBanner({ streak: 30, onDismiss });

      expect(result).not.toBeNull();
      expect(result?.props.variant).toBe("milestone");
    });

    it("should render default variant for non-milestone streak (5 days)", () => {
      const onDismiss = jest.fn();
      const result = StreakMilestoneBanner({ streak: 5, onDismiss });

      expect(result).not.toBeNull();
      expect(result?.props.variant).toBe("default");
    });

    it("should render default variant for non-milestone streak (8 days)", () => {
      const onDismiss = jest.fn();
      const result = StreakMilestoneBanner({ streak: 8, onDismiss });

      expect(result).not.toBeNull();
      expect(result?.props.variant).toBe("default");
    });
  });

  describe("Rendered Content", () => {
    it("should render with streak value for milestones", () => {
      const element = StreakMilestoneBanner({
        streak: 7,
        onDismiss: jest.fn(),
        testID: "streak-milestone-banner",
      });

      if (element) {
        render(element);
        expect(screen.getByTestId("streak-milestone-banner")).toBeTruthy();
        expect(screen.getByText(/🔥 7/)).toBeTruthy();
      }
    });
  });
});
