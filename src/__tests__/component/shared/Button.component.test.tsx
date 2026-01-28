// src/__tests__/component/shared/Button.component.test.tsx
// ============================================
// Button Component Tests
// ============================================

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ActivityIndicator } from "react-native";
import { Button, IconButton } from "@/components/shared/Button";

describe("Button", () => {
  describe("Rendering", () => {
    it("should render with text", () => {
      render(<Button testID="btn">Click Me</Button>);
      expect(screen.getByText("Click Me")).toBeTruthy();
    });

    it("should render with testID", () => {
      render(<Button testID="test-btn">Test</Button>);
      expect(screen.getByTestId("test-btn")).toBeTruthy();
    });
  });

  describe("Variants", () => {
    it("should render primary variant by default", () => {
      render(<Button testID="btn">Primary</Button>);
      expect(screen.getByTestId("btn")).toBeTruthy();
    });

    it("should render secondary variant", () => {
      render(
        <Button testID="btn" variant="secondary">
          Secondary
        </Button>,
      );
      expect(screen.getByTestId("btn")).toBeTruthy();
    });

    it("should render outline variant", () => {
      render(
        <Button testID="btn" variant="outline">
          Outline
        </Button>,
      );
      expect(screen.getByTestId("btn")).toBeTruthy();
    });

    it("should render ghost variant", () => {
      render(
        <Button testID="btn" variant="ghost">
          Ghost
        </Button>,
      );
      expect(screen.getByTestId("btn")).toBeTruthy();
    });

    it("should render danger variant", () => {
      render(
        <Button testID="btn" variant="danger">
          Danger
        </Button>,
      );
      expect(screen.getByTestId("btn")).toBeTruthy();
    });
  });

  describe("Sizes", () => {
    it("should render small size", () => {
      render(
        <Button testID="btn" size="sm">
          Small
        </Button>,
      );
      expect(screen.getByTestId("btn")).toBeTruthy();
    });

    it("should render medium size by default", () => {
      render(<Button testID="btn">Medium</Button>);
      expect(screen.getByTestId("btn")).toBeTruthy();
    });

    it("should render large size", () => {
      render(
        <Button testID="btn" size="lg">
          Large
        </Button>,
      );
      expect(screen.getByTestId("btn")).toBeTruthy();
    });
  });

  describe("Interactions", () => {
    it("should call onPress when pressed", () => {
      const onPress = jest.fn();
      render(
        <Button testID="btn" onPress={onPress}>
          Press Me
        </Button>,
      );
      fireEvent.press(screen.getByTestId("btn"));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should not call onPress when disabled", () => {
      const onPress = jest.fn();
      render(
        <Button testID="btn" onPress={onPress} disabled>
          Disabled
        </Button>,
      );
      fireEvent.press(screen.getByTestId("btn"));
      expect(onPress).not.toHaveBeenCalled();
    });

    it("should not call onPress when loading", () => {
      const onPress = jest.fn();
      render(
        <Button testID="btn" onPress={onPress} loading>
          Loading
        </Button>,
      );
      fireEvent.press(screen.getByTestId("btn"));
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe("Disabled State", () => {
    it("should have disabled accessibility state when disabled", () => {
      render(
        <Button testID="btn" disabled>
          Disabled
        </Button>,
      );
      const button = screen.getByTestId("btn");
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });

    it("should have disabled accessibility state when loading", () => {
      render(
        <Button testID="btn" loading>
          Loading
        </Button>,
      );
      const button = screen.getByTestId("btn");
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe("Loading State", () => {
    it("should show loading indicator when loading", () => {
      render(
        <Button testID="btn" loading>
          Loading
        </Button>,
      );
      // Button renders with ActivityIndicator when loading
      expect(screen.getByTestId("btn")).toBeTruthy();
      expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });

    it("should show text alongside loading indicator", () => {
      render(
        <Button testID="btn" loading>
          Loading Text
        </Button>,
      );
      // Our Button component shows both text and spinner
      expect(screen.getByText("Loading Text")).toBeTruthy();
    });
  });

  describe("Icons", () => {
    it("should render with left icon", () => {
      const Icon = () => null;
      render(
        <Button testID="btn" leftIcon={<Icon />}>
          With Icon
        </Button>,
      );
      expect(screen.getByTestId("btn")).toBeTruthy();
    });

    it("should render with right icon", () => {
      const Icon = () => null;
      render(
        <Button testID="btn" rightIcon={<Icon />}>
          With Icon
        </Button>,
      );
      expect(screen.getByTestId("btn")).toBeTruthy();
    });

    it("should not show left icon when loading", () => {
      const Icon = () => null;
      render(
        <Button testID="btn" leftIcon={<Icon />} loading>
          Loading
        </Button>,
      );
      // Left icon should be replaced by spinner
      expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });
  });

  describe("Full Width", () => {
    it("should render full width when fullWidth prop is true", () => {
      render(
        <Button testID="btn" fullWidth>
          Full Width
        </Button>,
      );
      expect(screen.getByTestId("btn")).toBeTruthy();
    });
  });

  describe("Custom Styles", () => {
    it("should accept custom style prop", () => {
      render(
        <Button testID="btn" style={{ marginTop: 20 }}>
          Styled
        </Button>,
      );
      expect(screen.getByTestId("btn")).toBeTruthy();
    });

    it("should accept custom textStyle prop", () => {
      render(
        <Button testID="btn" textStyle={{ letterSpacing: 1 }}>
          Custom Text
        </Button>,
      );
      expect(screen.getByTestId("btn")).toBeTruthy();
    });
  });
});

describe("IconButton", () => {
  describe("Rendering", () => {
    it("should render with icon", () => {
      const Icon = () => null;
      render(<IconButton icon={<Icon />} testID="icon-btn" />);
      expect(screen.getByTestId("icon-btn")).toBeTruthy();
    });
  });

  describe("Sizes", () => {
    it("should render small size", () => {
      const Icon = () => null;
      render(<IconButton icon={<Icon />} size="sm" testID="icon-btn" />);
      expect(screen.getByTestId("icon-btn")).toBeTruthy();
    });

    it("should render medium size by default", () => {
      const Icon = () => null;
      render(<IconButton icon={<Icon />} testID="icon-btn" />);
      expect(screen.getByTestId("icon-btn")).toBeTruthy();
    });

    it("should render large size", () => {
      const Icon = () => null;
      render(<IconButton icon={<Icon />} size="lg" testID="icon-btn" />);
      expect(screen.getByTestId("icon-btn")).toBeTruthy();
    });
  });

  describe("Variants", () => {
    it("should render ghost variant by default", () => {
      const Icon = () => null;
      render(<IconButton icon={<Icon />} testID="icon-btn" />);
      expect(screen.getByTestId("icon-btn")).toBeTruthy();
    });

    it("should render primary variant", () => {
      const Icon = () => null;
      render(
        <IconButton icon={<Icon />} variant="primary" testID="icon-btn" />,
      );
      expect(screen.getByTestId("icon-btn")).toBeTruthy();
    });
  });

  describe("Interactions", () => {
    it("should call onPress when pressed", () => {
      const onPress = jest.fn();
      const Icon = () => null;
      render(
        <IconButton icon={<Icon />} onPress={onPress} testID="icon-btn" />,
      );
      fireEvent.press(screen.getByTestId("icon-btn"));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should not call onPress when disabled", () => {
      const onPress = jest.fn();
      const Icon = () => null;
      render(
        <IconButton
          icon={<Icon />}
          onPress={onPress}
          disabled
          testID="icon-btn"
        />,
      );
      fireEvent.press(screen.getByTestId("icon-btn"));
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe("Loading State", () => {
    it("should show loading indicator when loading", () => {
      const Icon = () => null;
      render(<IconButton icon={<Icon />} loading testID="icon-btn" />);
      expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });

    it("should be disabled when loading", () => {
      const Icon = () => null;
      const onPress = jest.fn();
      render(
        <IconButton
          icon={<Icon />}
          loading
          onPress={onPress}
          testID="icon-btn"
        />,
      );
      fireEvent.press(screen.getByTestId("icon-btn"));
      expect(onPress).not.toHaveBeenCalled();
    });
  });
});
