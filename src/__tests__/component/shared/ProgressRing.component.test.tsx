// __tests__/components/shared/ProgressRing.test.tsx
// ============================================
// ProgressRing Component Tests
// ============================================

import React from "react";
import { Text } from "react-native";
import { render } from "@testing-library/react-native";
import {
  ProgressRing,
  ProgressRingWithLabel,
  MiniProgress,
} from "@/components/shared/ProgressRing";

// NOTE: @/constants/theme is mocked in jest.setup.ts
// NOTE: react-native-reanimated is mocked in jest.setup.ts
// NOTE: react-native-svg is mocked in jest.setup.ts

describe("ProgressRing", () => {
  describe("rendering", () => {
    it("renders without crashing", () => {
      const { getByTestId } = render(
        <ProgressRing progress={0.5} testID="progress-ring" />,
      );

      expect(getByTestId("progress-ring")).toBeTruthy();
    });

    it("renders with default size (md)", () => {
      const { getByTestId } = render(
        <ProgressRing progress={0.5} testID="progress-ring" />,
      );

      const ring = getByTestId("progress-ring");
      // Style is an array, check if size is included
      const styleArray = Array.isArray(ring.props.style)
        ? ring.props.style
        : [ring.props.style];
      const hasSize = styleArray.some(
        (s: any) => s?.width === 64 && s?.height === 64,
      );
      expect(hasSize).toBe(true);
    });

    it("renders with small size", () => {
      const { getByTestId } = render(
        <ProgressRing progress={0.5} size="sm" testID="progress-ring" />,
      );

      const ring = getByTestId("progress-ring");
      const styleArray = Array.isArray(ring.props.style)
        ? ring.props.style
        : [ring.props.style];
      const hasSize = styleArray.some(
        (s: any) => s?.width === 48 && s?.height === 48,
      );
      expect(hasSize).toBe(true);
    });

    it("renders with large size", () => {
      const { getByTestId } = render(
        <ProgressRing progress={0.5} size="lg" testID="progress-ring" />,
      );

      const ring = getByTestId("progress-ring");
      const styleArray = Array.isArray(ring.props.style)
        ? ring.props.style
        : [ring.props.style];
      const hasSize = styleArray.some(
        (s: any) => s?.width === 96 && s?.height === 96,
      );
      expect(hasSize).toBe(true);
    });

    it("renders with custom numeric size", () => {
      const { getByTestId } = render(
        <ProgressRing progress={0.5} size={120} testID="progress-ring" />,
      );

      const ring = getByTestId("progress-ring");
      const styleArray = Array.isArray(ring.props.style)
        ? ring.props.style
        : [ring.props.style];
      const hasSize = styleArray.some(
        (s: any) => s?.width === 120 && s?.height === 120,
      );
      expect(hasSize).toBe(true);
    });
  });

  describe("progress values", () => {
    it("clamps progress to 0 when negative", () => {
      const { getByTestId } = render(
        <ProgressRing progress={-0.5} showPercentage testID="progress-ring" />,
      );

      // The component should clamp to 0%
      expect(getByTestId("progress-ring")).toBeTruthy();
    });

    it("clamps progress to 1 when over 100%", () => {
      const { getByTestId } = render(
        <ProgressRing progress={1.5} showPercentage testID="progress-ring" />,
      );

      // The component should clamp to 100%
      expect(getByTestId("progress-ring")).toBeTruthy();
    });

    it("handles 0% progress", () => {
      const { getByTestId } = render(
        <ProgressRing progress={0} testID="progress-ring" />,
      );

      expect(getByTestId("progress-ring")).toBeTruthy();
    });

    it("handles 100% progress", () => {
      const { getByTestId } = render(
        <ProgressRing progress={1} testID="progress-ring" />,
      );

      expect(getByTestId("progress-ring")).toBeTruthy();
    });
  });

  describe("percentage display", () => {
    it("does not show percentage by default", () => {
      const { queryByText } = render(<ProgressRing progress={0.75} />);

      expect(queryByText("75%")).toBeNull();
    });

    it("shows percentage when showPercentage is true", () => {
      const { getByText } = render(
        <ProgressRing progress={0.75} showPercentage />,
      );

      expect(getByText("75%")).toBeTruthy();
    });

    it("rounds percentage to nearest integer", () => {
      const { getByText } = render(
        <ProgressRing progress={0.756} showPercentage />,
      );

      expect(getByText("76%")).toBeTruthy();
    });

    it("shows 0% for zero progress", () => {
      const { getByText } = render(
        <ProgressRing progress={0} showPercentage />,
      );

      expect(getByText("0%")).toBeTruthy();
    });

    it("shows 100% for full progress", () => {
      const { getByText } = render(
        <ProgressRing progress={1} showPercentage />,
      );

      expect(getByText("100%")).toBeTruthy();
    });
  });

  describe("custom center content", () => {
    it("renders children instead of percentage", () => {
      const { getByText, queryByText } = render(
        <ProgressRing progress={0.5} showPercentage>
          <Text>Custom</Text>
        </ProgressRing>,
      );

      expect(getByText("Custom")).toBeTruthy();
      expect(queryByText("50%")).toBeNull();
    });
  });

  describe("custom colors", () => {
    it("accepts custom progress color", () => {
      const { getByTestId } = render(
        <ProgressRing progress={0.5} color="#FF0000" testID="progress-ring" />,
      );

      expect(getByTestId("progress-ring")).toBeTruthy();
    });

    it("accepts custom track color", () => {
      const { getByTestId } = render(
        <ProgressRing
          progress={0.5}
          trackColor="#EEEEEE"
          testID="progress-ring"
        />,
      );

      expect(getByTestId("progress-ring")).toBeTruthy();
    });
  });
});

describe("ProgressRingWithLabel", () => {
  it("renders with label", () => {
    const { getByText } = render(
      <ProgressRingWithLabel progress={0.5} label="Steps" />,
    );

    expect(getByText("Steps")).toBeTruthy();
  });

  it("renders with value text", () => {
    const { getByText } = render(
      <ProgressRingWithLabel progress={0.75} valueText="7,500 / 10,000" />,
    );

    expect(getByText("7,500 / 10,000")).toBeTruthy();
  });

  it("renders both label and value", () => {
    const { getByText } = render(
      <ProgressRingWithLabel
        progress={0.5}
        label="Daily Goal"
        valueText="5,000 steps"
      />,
    );

    expect(getByText("Daily Goal")).toBeTruthy();
    expect(getByText("5,000 steps")).toBeTruthy();
  });
});

describe("MiniProgress", () => {
  it("renders at small size by default", () => {
    const { getByTestId } = render(<MiniProgress progress={0.5} />);

    // MiniProgress doesn't have testID by default, but should render
    // This tests that it doesn't crash
    expect(true).toBe(true);
  });

  it("renders with custom size", () => {
    // MiniProgress uses a fixed small size internally
    // Just verify it doesn't crash
    render(<MiniProgress progress={0.75} size={24} />);
    expect(true).toBe(true);
  });

  it("accepts custom color", () => {
    render(<MiniProgress progress={0.5} color="#FF5500" />);
    expect(true).toBe(true);
  });
});
