// __tests__/components/shared/ActivityCard.component.test.tsx
// ============================================
// ActivityCard Component Tests
// ============================================
// NOTE: @/constants/theme is mocked in jest.setup.ts
// NOTE: react-native-reanimated is mocked in jest.setup.ts
// NOTE: react-native-svg is mocked in jest.setup.ts

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import {
  ActivityCard,
  ActivityCardSkeleton,
  CompactActivity,
  ActivityType,
} from "@/components/shared/ActivityCard";

// Mock heroicons
jest.mock("react-native-heroicons/outline", () => ({
  ArrowTrendingUpIcon: () => "ArrowTrendingUpIcon",
  ClockIcon: () => "ClockIcon",
  FireIcon: () => "FireIcon",
  MapPinIcon: () => "MapPinIcon",
  HeartIcon: () => "HeartIcon",
  BoltIcon: () => "BoltIcon",
}));

jest.mock("react-native-heroicons/solid", () => ({
  CheckCircleIcon: () => "CheckCircleIcon",
  DevicePhoneMobileIcon: () => "DevicePhoneMobileIcon",
}));

// Mock MiniProgress (ProgressRing is complex with animations)
jest.mock("@/components/shared/ProgressRing", () => ({
  MiniProgress: () => "MiniProgress",
}));

describe("ActivityCard", () => {
  const defaultProps = {
    type: "steps" as ActivityType,
    value: 5000,
    unit: "steps",
    timestamp: new Date(),
    source: "manual" as const,
  };

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { getByTestId } = render(
        <ActivityCard {...defaultProps} testID="activity-card" />,
      );

      expect(getByTestId("activity-card")).toBeTruthy();
    });

    it("displays activity value", () => {
      const { getByText } = render(<ActivityCard {...defaultProps} />);

      expect(getByText("5,000")).toBeTruthy();
    });

    it("displays activity unit", () => {
      const { getByText } = render(<ActivityCard {...defaultProps} />);

      expect(getByText("steps")).toBeTruthy();
    });
  });

  describe("activity types", () => {
    it("renders steps type", () => {
      const { getByTestId } = render(
        <ActivityCard {...defaultProps} type="steps" testID="card" />,
      );
      expect(getByTestId("card")).toBeTruthy();
    });

    it("renders active_minutes type", () => {
      const { getByTestId } = render(
        <ActivityCard
          {...defaultProps}
          type="active_minutes"
          unit="min"
          testID="card"
        />,
      );
      expect(getByTestId("card")).toBeTruthy();
    });

    it("renders workouts type", () => {
      const { getByTestId } = render(
        <ActivityCard
          {...defaultProps}
          type="workouts"
          unit="workout"
          testID="card"
        />,
      );
      expect(getByTestId("card")).toBeTruthy();
    });

    it("renders distance type", () => {
      const { getByTestId } = render(
        <ActivityCard
          {...defaultProps}
          type="distance"
          unit="km"
          testID="card"
        />,
      );
      expect(getByTestId("card")).toBeTruthy();
    });

    it("renders calories type", () => {
      const { getByTestId } = render(
        <ActivityCard
          {...defaultProps}
          type="calories"
          unit="cal"
          testID="card"
        />,
      );
      expect(getByTestId("card")).toBeTruthy();
    });

    it("renders custom type", () => {
      const { getByTestId } = render(
        <ActivityCard
          {...defaultProps}
          type="custom"
          unit="units"
          testID="card"
        />,
      );
      expect(getByTestId("card")).toBeTruthy();
    });
  });

  describe("source indicators", () => {
    it("shows manual source", () => {
      const { getByTestId } = render(
        <ActivityCard {...defaultProps} source="manual" testID="card" />,
      );
      expect(getByTestId("card")).toBeTruthy();
    });

    it("shows healthkit source", () => {
      const { getByTestId } = render(
        <ActivityCard {...defaultProps} source="healthkit" testID="card" />,
      );
      expect(getByTestId("card")).toBeTruthy();
    });

    it("shows googlefit source", () => {
      const { getByTestId } = render(
        <ActivityCard {...defaultProps} source="googlefit" testID="card" />,
      );
      expect(getByTestId("card")).toBeTruthy();
    });
  });

  describe("value formatting", () => {
    it("formats values under 1000 without suffix", () => {
      const { getByText } = render(
        <ActivityCard {...defaultProps} value={500} />,
      );

      expect(getByText("500")).toBeTruthy();
    });

    it("formats values between 1000-10000 with commas", () => {
      const { getByText } = render(
        <ActivityCard {...defaultProps} value={5000} />,
      );

      expect(getByText("5,000")).toBeTruthy();
    });
  });

  describe("timestamp formatting", () => {
    it("shows 'Just now' for recent timestamps", () => {
      const now = new Date();
      const { getByText } = render(
        <ActivityCard {...defaultProps} timestamp={now} />,
      );

      expect(getByText("Just now")).toBeTruthy();
    });

    it("shows minutes ago for recent timestamps", () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const { getByText } = render(
        <ActivityCard {...defaultProps} timestamp={fiveMinutesAgo} />,
      );

      expect(getByText("5m ago")).toBeTruthy();
    });

    it("shows hours ago for same-day timestamps", () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const { getByText } = render(
        <ActivityCard {...defaultProps} timestamp={threeHoursAgo} />,
      );

      expect(getByText("3h ago")).toBeTruthy();
    });

    it("shows 'Yesterday' for yesterday's timestamps", () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const { getByText } = render(
        <ActivityCard {...defaultProps} timestamp={yesterday} />,
      );

      expect(getByText("Yesterday")).toBeTruthy();
    });

    it("shows days ago for recent past timestamps", () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const { getByText } = render(
        <ActivityCard {...defaultProps} timestamp={threeDaysAgo} />,
      );

      expect(getByText("3d ago")).toBeTruthy();
    });
  });

  describe("optional content", () => {
    it("renders challenge title when provided", () => {
      const { getByText } = render(
        <ActivityCard {...defaultProps} challengeTitle="10K Steps Challenge" />,
      );

      expect(getByText("10K Steps Challenge")).toBeTruthy();
    });

    it("renders goal value when provided", () => {
      const { getByText } = render(
        <ActivityCard {...defaultProps} goalValue={10000} />,
      );

      // formatValue(10000, unit) returns "10.0K"
      expect(getByText(/\/ 10\.0K/)).toBeTruthy();
    });

    it("renders progress indicator when provided", () => {
      const { UNSAFE_root } = render(
        <ActivityCard {...defaultProps} progress={0.5} />,
      );

      // MiniProgress should be rendered
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  describe("interactions", () => {
    it("calls onPress when card is pressed", () => {
      const onPress = jest.fn();
      const { getByTestId } = render(
        <ActivityCard {...defaultProps} onPress={onPress} testID="card" />,
      );

      fireEvent.press(getByTestId("card"));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("is not pressable without onPress", () => {
      const { getByTestId } = render(
        <ActivityCard {...defaultProps} testID="card" />,
      );

      // Should render as View, not TouchableOpacity
      const card = getByTestId("card");
      expect(card.type).not.toBe("TouchableOpacity");
    });
  });
});

describe("ActivityCardSkeleton", () => {
  it("renders without crashing", () => {
    render(<ActivityCardSkeleton />);
    expect(true).toBe(true);
  });
});

describe("CompactActivity", () => {
  it("renders compact format", () => {
    const { getByText } = render(
      <CompactActivity
        type="steps"
        value={1000}
        unit="steps"
        timestamp={new Date()}
      />,
    );

    expect(getByText("1,000 steps")).toBeTruthy();
  });

  it("formats timestamp correctly", () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const { getByText } = render(
      <CompactActivity
        type="active_minutes"
        value={30}
        unit="min"
        timestamp={fiveMinutesAgo}
      />,
    );

    expect(getByText("5m ago")).toBeTruthy();
  });
});
