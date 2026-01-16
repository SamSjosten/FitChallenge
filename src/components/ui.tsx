// src/components/ui.tsx
// Basic UI components for FitChallenge
// Updated to use design system theme tokens

import React from "react";

// Re-export layout components for unified imports
export {
  ScreenContainer,
  ScreenHeader,
  ScreenSection,
  useScreenLayout,
  LAYOUT,
} from "./ScreenContainer";
import {
  StyleProp,
  TouchableOpacity,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  StyleSheet,
  TextInputProps,
  TouchableOpacityProps,
  ViewStyle,
  TextStyle,
  Animated,
  Pressable,
} from "react-native";
import {
  colors as themeColors,
  typography,
  spacing,
  radius,
  shadows,
  useTheme,
} from "@/constants/theme";

// =============================================================================
// BUTTON
// =============================================================================

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?:
    | "primary"
    | "secondary"
    | "outline"
    | "danger"
    | "energy"
    | "achievement";
  size?: "small" | "medium" | "large";
  loading?: boolean;
}

export function Button({
  title,
  variant = "primary",
  size = "medium",
  loading = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const { colors, shadows: themeShadows } = useTheme();

  // Animated scale for press feedback
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };

  const getVariantStyles = (): { button: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case "primary":
        return {
          button: {
            backgroundColor: colors.primary.main,
            ...themeShadows.button,
          },
          text: { color: colors.primary.contrast },
        };
      case "secondary":
        return {
          button: { backgroundColor: colors.surfacePressed },
          text: { color: colors.textPrimary },
        };
      case "outline":
        return {
          button: {
            backgroundColor: "transparent",
            borderWidth: 1,
            borderColor: colors.primary.main,
          },
          text: { color: colors.primary.main },
        };
      case "danger":
        return {
          button: { backgroundColor: colors.error },
          text: { color: colors.textInverse },
        };
      case "energy":
        return {
          button: {
            backgroundColor: colors.energy.main,
            ...themeShadows.button,
          },
          text: { color: colors.energy.contrast },
        };
      case "achievement":
        return {
          button: {
            backgroundColor: colors.achievement.main,
            ...themeShadows.button,
          },
          text: { color: colors.achievement.contrast },
        };
      default:
        return {
          button: { backgroundColor: colors.primary.main },
          text: { color: colors.primary.contrast },
        };
    }
  };

  const getSizeStyles = (): { button: ViewStyle; text: TextStyle } => {
    switch (size) {
      case "small":
        return {
          button: {
            paddingHorizontal: spacing.button.paddingXSmall,
            paddingVertical: spacing.button.paddingYSmall,
            minHeight: 32,
          },
          text: { fontSize: 12, fontWeight: "600" },
        };
      case "large":
        return {
          button: {
            paddingHorizontal: 24,
            paddingVertical: 16,
            minHeight: 52,
          },
          text: { fontSize: 16, fontWeight: "600" },
        };
      default: // medium
        return {
          button: {
            paddingHorizontal: spacing.button.paddingX,
            paddingVertical: spacing.button.paddingY,
            minHeight: 44,
          },
          text: {
            fontSize: typography.textStyles.label.fontSize,
            fontWeight: typography.textStyles.label
              .fontWeight as TextStyle["fontWeight"],
          },
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[
          {
            borderRadius: radius.button,
            alignItems: "center",
            justifyContent: "center",
          },
          variantStyles.button,
          sizeStyles.button,
          disabled && { opacity: 0.5 },
          style,
        ]}
        disabled={disabled || loading}
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        {...props}
      >
        {loading ? (
          <ActivityIndicator color={variantStyles.text.color} size="small" />
        ) : (
          <Text
            style={[
              {
                fontFamily: "PlusJakartaSans_600SemiBold",
              },
              variantStyles.text,
              sizeStyles.text,
            ]}
          >
            {title}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// =============================================================================
// INPUT
// =============================================================================

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Input({
  label,
  error,
  style,
  containerStyle,
  ...props
}: InputProps) {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <View style={[{ marginBottom: spacing.lg }, containerStyle]}>
      {label && (
        <Text
          style={{
            fontSize: typography.textStyles.label.fontSize,
            fontWeight: typography.textStyles.label
              .fontWeight as TextStyle["fontWeight"],
            fontFamily: "PlusJakartaSans_600SemiBold",
            color: colors.textPrimary,
            marginBottom: spacing.sm,
          }}
        >
          {label}
        </Text>
      )}
      <TextInput
        style={[
          {
            borderWidth: 1,
            borderColor: error
              ? colors.error
              : isFocused
              ? colors.borderFocus
              : colors.border,
            borderRadius: radius.input,
            paddingHorizontal: spacing.input.paddingX,
            paddingVertical: spacing.input.paddingY,
            fontSize: typography.textStyles.body.fontSize,
            fontFamily: "PlusJakartaSans_500Medium",
            backgroundColor: colors.surface,
            color: colors.textPrimary,
            minHeight: 44,
          },
          style,
        ]}
        placeholderTextColor={colors.textMuted}
        onFocus={(e) => {
          setIsFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          props.onBlur?.(e);
        }}
        {...props}
      />
      {error && (
        <Text
          style={{
            fontSize: typography.textStyles.caption.fontSize,
            fontFamily: "PlusJakartaSans_500Medium",
            color: colors.error,
            marginTop: spacing.xs,
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}

// =============================================================================
// CARD
// =============================================================================

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  elevated?: boolean;
}

export function Card({
  children,
  style,
  onPress,
  elevated = false,
}: CardProps) {
  const { colors, shadows: themeShadows } = useTheme();
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.card,
          padding: spacing.card.padding,
          ...(elevated ? themeShadows.elevated : themeShadows.card),
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {children}
    </Wrapper>
  );
}

// =============================================================================
// BADGE
// =============================================================================

interface BadgeProps {
  children: React.ReactNode;
  variant?: "primary" | "energy" | "achievement" | "muted";
  size?: "small" | "medium";
}

export function Badge({
  children,
  variant = "primary",
  size = "small",
}: BadgeProps) {
  const { colors } = useTheme();

  const getVariantColors = () => {
    switch (variant) {
      case "energy":
        return { bg: colors.energy.subtle, text: colors.energy.main };
      case "achievement":
        return { bg: colors.achievement.subtle, text: colors.achievement.main };
      case "muted":
        return { bg: colors.surfacePressed, text: colors.textMuted };
      default:
        return { bg: colors.primary.subtle, text: colors.primary.main };
    }
  };

  const variantColors = getVariantColors();

  return (
    <View
      style={{
        backgroundColor: variantColors.bg,
        paddingHorizontal: size === "small" ? 6 : 8,
        paddingVertical: size === "small" ? 2 : 4,
        borderRadius: radius.tag,
      }}
    >
      <Text
        style={{
          fontSize: size === "small" ? 10 : 12,
          fontWeight: "600",
          fontFamily: "PlusJakartaSans_600SemiBold",
          color: variantColors.text,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

// =============================================================================
// PROGRESS BAR
// =============================================================================

interface ProgressBarProps {
  progress: number; // 0-100
  variant?: "primary" | "energy" | "achievement";
  size?: "small" | "medium" | "large";
  animated?: boolean;
}

export function ProgressBar({
  progress,
  variant = "primary",
  size = "medium",
  animated = true,
}: ProgressBarProps) {
  const { colors } = useTheme();
  const animatedWidth = React.useRef(new Animated.Value(0)).current;

  // Clamp progress to 0-100 range to prevent overflow
  const clampedProgress = Math.min(100, Math.max(0, progress));

  React.useEffect(() => {
    if (animated) {
      Animated.timing(animatedWidth, {
        toValue: clampedProgress,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      animatedWidth.setValue(clampedProgress);
    }
  }, [clampedProgress, animated]);

  const getVariantColor = () => {
    switch (variant) {
      case "energy":
        return { bg: colors.energy.subtle, fill: colors.energy.main };
      case "achievement":
        return { bg: colors.achievement.subtle, fill: colors.achievement.main };
      default:
        return { bg: colors.primary.subtle, fill: colors.primary.main };
    }
  };

  const getHeight = () => {
    switch (size) {
      case "small":
        return 4;
      case "large":
        return 8;
      default:
        return 6;
    }
  };

  const variantColor = getVariantColor();
  const height = getHeight();

  return (
    <View
      style={{
        height,
        backgroundColor: variantColor.bg,
        borderRadius: radius.progressBar,
        overflow: "hidden",
      }}
    >
      <Animated.View
        style={{
          height: "100%",
          backgroundColor: variantColor.fill,
          borderRadius: radius.progressBar,
          width: animatedWidth.interpolate({
            inputRange: [0, 100],
            outputRange: ["0%", "100%"],
          }),
        }}
      />
    </View>
  );
}

// =============================================================================
// LOADING SCREEN
// =============================================================================

export function LoadingScreen() {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
      }}
    >
      <ActivityIndicator size="large" color={colors.primary.main} />
    </View>
  );
}

// =============================================================================
// ERROR MESSAGE
// =============================================================================

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        padding: spacing.lg,
        alignItems: "center",
        gap: spacing.md,
      }}
    >
      <Text
        style={{
          fontSize: typography.textStyles.body.fontSize,
          fontFamily: "PlusJakartaSans_500Medium",
          color: colors.error,
          textAlign: "center",
        }}
      >
        {message}
      </Text>
      {onRetry && (
        <Button
          title="Retry"
          variant="outline"
          size="small"
          onPress={onRetry}
        />
      )}
    </View>
  );
}

// =============================================================================
// EMPTY STATE
// =============================================================================

interface EmptyStateProps {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: spacing["2xl"],
      }}
    >
      <Text
        style={{
          fontSize: typography.textStyles.headline.fontSize,
          fontWeight: typography.textStyles.headline
            .fontWeight as TextStyle["fontWeight"],
          fontFamily: "PlusJakartaSans_600SemiBold",
          color: colors.textPrimary,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      {message && (
        <Text
          style={{
            fontSize: typography.textStyles.body.fontSize,
            fontFamily: "PlusJakartaSans_500Medium",
            color: colors.textSecondary,
            textAlign: "center",
            marginTop: spacing.sm,
          }}
        >
          {message}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button
          title={actionLabel}
          onPress={onAction}
          style={{ marginTop: spacing.lg }}
        />
      )}
    </View>
  );
}

// =============================================================================
// SECTION HEADER
// =============================================================================

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: spacing.md,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: typography.textStyles.title.fontSize,
            fontWeight: typography.textStyles.title
              .fontWeight as TextStyle["fontWeight"],
            fontFamily: "PlusJakartaSans_600SemiBold",
            color: colors.textPrimary,
          }}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            style={{
              fontSize: typography.textStyles.caption.fontSize,
              fontFamily: "PlusJakartaSans_500Medium",
              color: colors.textSecondary,
              marginTop: 2,
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {action && (
        <TouchableOpacity onPress={action.onPress}>
          <Text
            style={{
              fontSize: typography.textStyles.label.fontSize,
              fontFamily: "PlusJakartaSans_600SemiBold",
              color: colors.primary.main,
            }}
          >
            {action.label}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// =============================================================================
// AVATAR
// =============================================================================

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

export function Avatar({ uri, name, size = "md" }: AvatarProps) {
  const { colors, componentSize } = useTheme();
  const avatarSize = componentSize.avatar[size];

  const getInitials = (name?: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (uri) {
    return (
      <View
        style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius: radius.avatar,
          backgroundColor: colors.surfacePressed,
          overflow: "hidden",
        }}
      >
        {/* Note: Image component would go here */}
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: colors.primary.subtle,
          }}
        >
          <Text
            style={{
              fontSize: avatarSize * 0.4,
              fontWeight: "600",
              fontFamily: "PlusJakartaSans_600SemiBold",
              color: colors.primary.main,
            }}
          >
            {getInitials(name)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        width: avatarSize,
        height: avatarSize,
        borderRadius: radius.avatar,
        backgroundColor: colors.primary.subtle,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontSize: avatarSize * 0.4,
          fontWeight: "600",
          fontFamily: "PlusJakartaSans_600SemiBold",
          color: colors.primary.main,
        }}
      >
        {getInitials(name)}
      </Text>
    </View>
  );
}

// =============================================================================
// DIVIDER
// =============================================================================

interface DividerProps {
  style?: StyleProp<ViewStyle>;
}

export function Divider({ style }: DividerProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        {
          height: 1,
          backgroundColor: colors.border,
        },
        style,
      ]}
    />
  );
}

// =============================================================================
// LEGACY STYLES (for backwards compatibility during transition)
// =============================================================================

const styles = StyleSheet.create({
  // Button styles (legacy)
  button: {
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  button_primary: {
    backgroundColor: "#00D26A",
  },
  button_secondary: {
    backgroundColor: "#E5E5EA",
  },
  button_outline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#00D26A",
  },
  button_danger: {
    backgroundColor: "#EF4444",
  },
  button_disabled: {
    opacity: 0.5,
  },
  button_small: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  button_medium: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  button_large: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  buttonText: {
    fontWeight: "600",
  },
  buttonText_primary: {
    color: "#fff",
  },
  buttonText_secondary: {
    color: "#000",
  },
  buttonText_outline: {
    color: "#00D26A",
  },
  buttonText_danger: {
    color: "#fff",
  },
  buttonText_small: {
    fontSize: 14,
  },
  buttonText_medium: {
    fontSize: 16,
  },
  buttonText_large: {
    fontSize: 18,
  },

  // Input styles (legacy)
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D1D6",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  input_error: {
    borderColor: "#EF4444",
  },
  inputError: {
    fontSize: 12,
    color: "#EF4444",
    marginTop: 4,
  },

  // Card styles (legacy)
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  // Loading styles (legacy)
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
  },

  // Error styles (legacy)
  errorContainer: {
    padding: 16,
    alignItems: "center",
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    color: "#EF4444",
    textAlign: "center",
  },

  // Empty state styles (legacy)
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
  },
  emptyMessage: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
  },
});
