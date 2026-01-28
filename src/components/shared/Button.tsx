// src/components/shared/Button.tsx
// ============================================
// Button Component
// ============================================
// Core button component with multiple variants.
//
// Usage:
//   <Button variant="primary" onPress={handlePress}>
//     Get Started
//   </Button>

import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
  TextStyle,
} from "react-native";
import { useTheme } from "@/constants/theme";

// =============================================================================
// TYPES
// =============================================================================

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps {
  /** Button content */
  children: React.ReactNode;

  /** Button variant */
  variant?: ButtonVariant;

  /** Button size */
  size?: ButtonSize;

  /** Press handler */
  onPress?: () => void;

  /** Disabled state */
  disabled?: boolean;

  /** Loading state */
  loading?: boolean;

  /** Icon to show before text */
  leftIcon?: React.ReactNode;

  /** Icon to show after text */
  rightIcon?: React.ReactNode;

  /** Full width button */
  fullWidth?: boolean;

  /** Container style */
  style?: ViewStyle;

  /** Text style */
  textStyle?: TextStyle;

  /** Test ID */
  testID?: string;
}

// =============================================================================
// SIZE CONFIGURATIONS
// =============================================================================

interface SizeConfig {
  paddingVertical: number;
  paddingHorizontal: number;
  fontSize: number;
  iconSize: number;
  borderRadius: number;
}

const getSizeConfig = (
  size: ButtonSize,
  spacing: ReturnType<typeof useTheme>["spacing"],
  typography: ReturnType<typeof useTheme>["typography"],
  radius: ReturnType<typeof useTheme>["radius"],
): SizeConfig => {
  const configs: Record<ButtonSize, SizeConfig> = {
    sm: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      fontSize: typography.fontSize.sm,
      iconSize: 16,
      borderRadius: radius.button,
    },
    md: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      fontSize: typography.fontSize.base,
      iconSize: 18,
      borderRadius: radius.button,
    },
    lg: {
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      fontSize: typography.fontSize.lg,
      iconSize: 20,
      borderRadius: radius.button,
    },
  };

  return configs[size];
};

// =============================================================================
// VARIANT CONFIGURATIONS
// =============================================================================

interface VariantConfig {
  backgroundColor: string;
  textColor: string;
  borderColor?: string;
  borderWidth?: number;
  disabledBackgroundColor: string;
  disabledTextColor: string;
}

const getVariantConfig = (
  variant: ButtonVariant,
  colors: ReturnType<typeof useTheme>["colors"],
): VariantConfig => {
  const configs: Record<ButtonVariant, VariantConfig> = {
    primary: {
      backgroundColor: colors.primary.main,
      textColor: colors.primary.contrast,
      disabledBackgroundColor: colors.primary.subtle,
      disabledTextColor: colors.textMuted,
    },
    secondary: {
      backgroundColor: colors.primary.subtle,
      textColor: colors.primary.main,
      disabledBackgroundColor: colors.surfacePressed,
      disabledTextColor: colors.textMuted,
    },
    outline: {
      backgroundColor: "transparent",
      textColor: colors.primary.main,
      borderColor: colors.primary.main,
      borderWidth: 1.5,
      disabledBackgroundColor: "transparent",
      disabledTextColor: colors.textMuted,
    },
    ghost: {
      backgroundColor: "transparent",
      textColor: colors.primary.main,
      disabledBackgroundColor: "transparent",
      disabledTextColor: colors.textMuted,
    },
    danger: {
      backgroundColor: colors.error,
      textColor: "#FFFFFF",
      disabledBackgroundColor: `${colors.error}40`,
      disabledTextColor: "#FFFFFF80",
    },
  };

  return configs[variant];
};

// =============================================================================
// COMPONENT
// =============================================================================

export function Button({
  children,
  variant = "primary",
  size = "md",
  onPress,
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  style,
  textStyle,
  testID,
}: ButtonProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const sizeConfig = getSizeConfig(size, spacing, typography, radius);
  const variantConfig = getVariantConfig(variant, colors);

  const isDisabled = disabled || loading;

  const buttonStyle: ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: sizeConfig.paddingVertical,
    paddingHorizontal: sizeConfig.paddingHorizontal,
    borderRadius: sizeConfig.borderRadius,
    backgroundColor: isDisabled
      ? variantConfig.disabledBackgroundColor
      : variantConfig.backgroundColor,
    borderColor: isDisabled ? colors.border : variantConfig.borderColor,
    borderWidth: variantConfig.borderWidth,
    opacity: isDisabled ? 0.7 : 1,
    ...(fullWidth ? { width: "100%" } : {}),
  };

  const labelStyle: TextStyle = {
    fontSize: sizeConfig.fontSize,
    fontWeight: typography.fontWeight.semibold as any,
    color: isDisabled
      ? variantConfig.disabledTextColor
      : variantConfig.textColor,
    textAlign: "center",
  };

  return (
    <TouchableOpacity
      style={[buttonStyle, style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantConfig.textColor}
          style={{ marginRight: children ? spacing.sm : 0 }}
        />
      ) : leftIcon ? (
        <View style={{ marginRight: spacing.sm }}>{leftIcon}</View>
      ) : null}

      {typeof children === "string" ? (
        <Text style={[labelStyle, textStyle]}>{children}</Text>
      ) : (
        children
      )}

      {!loading && rightIcon && (
        <View style={{ marginLeft: spacing.sm }}>{rightIcon}</View>
      )}
    </TouchableOpacity>
  );
}

// =============================================================================
// ICON BUTTON VARIANT
// =============================================================================

export interface IconButtonProps {
  /** Icon element */
  icon: React.ReactNode;

  /** Press handler */
  onPress?: () => void;

  /** Button size */
  size?: ButtonSize;

  /** Button variant */
  variant?: ButtonVariant;

  /** Disabled state */
  disabled?: boolean;

  /** Loading state */
  loading?: boolean;

  /** Container style */
  style?: ViewStyle;

  /** Test ID */
  testID?: string;
}

export function IconButton({
  icon,
  onPress,
  size = "md",
  variant = "ghost",
  disabled = false,
  loading = false,
  style,
  testID,
}: IconButtonProps) {
  const { colors, spacing, radius } = useTheme();
  const variantConfig = getVariantConfig(variant, colors);

  const sizeMap: Record<ButtonSize, number> = {
    sm: 32,
    md: 40,
    lg: 48,
  };

  const buttonSize = sizeMap[size];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        {
          width: buttonSize,
          height: buttonSize,
          borderRadius: radius.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isDisabled
            ? variantConfig.disabledBackgroundColor
            : variantConfig.backgroundColor,
          opacity: isDisabled ? 0.7 : 1,
        },
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variantConfig.textColor} />
      ) : (
        icon
      )}
    </TouchableOpacity>
  );
}

export default Button;
