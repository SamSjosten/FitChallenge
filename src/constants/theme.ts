// ============================================
// FITCHALLENGE DESIGN SYSTEM - THEME TOKENS
// ============================================
// Single source of truth for all design decisions
// Generated: January 2025
// ============================================

import { useColorScheme } from "react-native";

// ============================================
// COLORS
// ============================================

export const colors = {
  // ===========================================
  // LIGHT MODE
  // ===========================================
  light: {
    // Brand Colors
    primary: {
      main: "#00D26A", // Electric Mint - Growth, health, main actions
      dark: "#00B85C", // Pressed/hover state
      light: "#6EE7A0", // Lighter variant
      subtle: "#D1FAE5", // Backgrounds, subtle fills
      contrast: "#FFFFFF", // Text on primary
    },
    energy: {
      main: "#FF6B35", // Sunset Orange - Streaks, motivation, urgency
      dark: "#E85A2A", // Pressed/hover state
      light: "#FFB088", // Lighter variant
      subtle: "#FFF0EB", // Backgrounds, subtle fills
      contrast: "#FFFFFF", // Text on energy
    },
    achievement: {
      main: "#8B5CF6", // Violet - Celebrations, medals, rankings
      dark: "#7C3AED", // Pressed/hover state
      light: "#A78BFA", // Lighter variant
      subtle: "#EDE9FE", // Backgrounds, subtle fills
      contrast: "#FFFFFF", // Text on achievement
    },

    // Semantic Colors
    success: "#00D26A",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#3B82F6",

    // Surfaces
    background: "#F8FAF9",
    surface: "#FFFFFF",
    surfaceElevated: "#FFFFFF",
    surfacePressed: "#F1F5F9",

    // Borders
    border: "#E2E8F0",
    borderStrong: "#CBD5E1",
    borderFocus: "#00D26A",

    // Text
    textPrimary: "#0F172A",
    textSecondary: "#64748B",
    textMuted: "#94A3B8",
    textInverse: "#FFFFFF",

    // Overlays
    overlay: "rgba(15, 23, 42, 0.5)",
    scrim: "rgba(15, 23, 42, 0.3)",
  },

  // ===========================================
  // DARK MODE (Dark Gray Strategy)
  // ===========================================
  dark: {
    // Brand Colors (slightly adjusted for dark backgrounds)
    primary: {
      main: "#00D26A",
      dark: "#00E676", // Brighter for dark mode
      light: "#6EE7A0",
      subtle: "rgba(0, 210, 106, 0.12)",
      contrast: "#FFFFFF",
    },
    energy: {
      main: "#FF6B35",
      dark: "#FF8A5B", // Brighter for dark mode
      light: "#FFB088",
      subtle: "rgba(255, 107, 53, 0.12)",
      contrast: "#FFFFFF",
    },
    achievement: {
      main: "#A78BFA", // Slightly lighter for dark mode
      dark: "#B79FFC",
      light: "#C4B5FD",
      subtle: "rgba(167, 139, 250, 0.12)",
      contrast: "#FFFFFF",
    },

    // Semantic Colors
    success: "#00D26A",
    warning: "#FBBF24",
    error: "#F87171",
    info: "#60A5FA",

    // Surfaces (Dark Gray)
    background: "#121214",
    surface: "#1C1C1F",
    surfaceElevated: "#252528",
    surfacePressed: "#2E2E32",

    // Borders
    border: "#2E2E32",
    borderStrong: "#3F3F46",
    borderFocus: "#00D26A",

    // Text
    textPrimary: "#FAFAFA",
    textSecondary: "#A1A1AA",
    textMuted: "#71717A",
    textInverse: "#0F172A",

    // Overlays
    overlay: "rgba(0, 0, 0, 0.7)",
    scrim: "rgba(0, 0, 0, 0.5)",
  },
} as const;

// ============================================
// TYPOGRAPHY
// ============================================

export const typography = {
  // Font Family
  fontFamily: {
    sans: "PlusJakartaSans",
    // Fallbacks for web: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },

  // Font Weights
  fontWeight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },

  // Type Scale
  fontSize: {
    xs: 11,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 20,
    "2xl": 24,
    "3xl": 30,
    "4xl": 36,
  },

  // Line Heights
  lineHeight: {
    tight: 1.2,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
  },

  // Letter Spacing
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
  },

  // Pre-defined Text Styles
  textStyles: {
    // Display - Hero text, large numbers
    display: {
      fontSize: 24,
      fontWeight: "700",
      lineHeight: 1.2,
      letterSpacing: -0.5,
    },
    // Headline - Section titles, card titles
    headline: {
      fontSize: 18,
      fontWeight: "600",
      lineHeight: 1.375,
      letterSpacing: 0,
    },
    // Title - Smaller titles, list headers
    title: {
      fontSize: 16,
      fontWeight: "600",
      lineHeight: 1.375,
      letterSpacing: 0,
    },
    // Body - Main content text
    body: {
      fontSize: 14,
      fontWeight: "500",
      lineHeight: 1.5,
      letterSpacing: 0,
    },
    // Label - Form labels, buttons, tags
    label: {
      fontSize: 13,
      fontWeight: "600",
      lineHeight: 1.375,
      letterSpacing: 0,
    },
    // Caption - Helper text, timestamps
    caption: {
      fontSize: 12,
      fontWeight: "500",
      lineHeight: 1.5,
      letterSpacing: 0,
    },
    // Overline - Section labels, categories
    overline: {
      fontSize: 11,
      fontWeight: "600",
      lineHeight: 1.5,
      letterSpacing: 0.5,
      textTransform: "uppercase" as const,
    },
  },
} as const;

// ============================================
// SPACING (Comfortable Scale)
// ============================================

export const spacing = {
  // Base Scale (4px increments)
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  "4xl": 48,
  "5xl": 64,
  "6xl": 80,

  // Component-specific spacing
  card: {
    padding: 16,
    paddingLarge: 20,
    gap: 12,
  },
  button: {
    paddingX: 16,
    paddingY: 12,
    paddingXSmall: 12,
    paddingYSmall: 8,
    gap: 8,
  },
  input: {
    paddingX: 14,
    paddingY: 12,
  },
  list: {
    itemGap: 12,
    itemPadding: 14,
    itemPaddingX: 16,
  },
  section: {
    gap: 24,
    marginBottom: 24,
  },
  screen: {
    padding: 16,
    paddingTop: 8,
  },
  modal: {
    padding: 24,
    gap: 16,
  },
} as const;

// ============================================
// BORDER RADIUS (Subtle Rounds)
// ============================================

export const radius = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  "2xl": 16,
  full: 999,

  // Semantic aliases
  card: 8,
  cardInner: 6,
  button: 6,
  input: 6,
  badge: 6,
  tag: 4,
  avatar: 999,
  modal: 12,
  progressBar: 4,
} as const;

// ============================================
// SHADOWS (Soft & Subtle)
// ============================================

export const shadows = {
  // Light mode shadows
  light: {
    none: "none",
    sm: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    card: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
    },
    elevated: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07,
      shadowRadius: 6,
      elevation: 4,
    },
    button: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    modal: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.15,
      shadowRadius: 25,
      elevation: 10,
    },
    float: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 14,
      elevation: 6,
    },
  },

  // Dark mode shadows (more subtle)
  dark: {
    none: "none",
    sm: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 1,
    },
    card: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 2,
    },
    elevated: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 4,
    },
    button: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 1,
    },
    modal: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.6,
      shadowRadius: 30,
      elevation: 10,
    },
    float: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 16,
      elevation: 6,
    },
  },
} as const;

// ============================================
// ANIMATION (Smooth & Fluid + Playful Celebrations)
// ============================================

export const animation = {
  // Duration scale (milliseconds)
  duration: {
    instant: 0,
    micro: 150, // Hovers, toggles
    short: 200, // Buttons, badges
    medium: 300, // Cards, modals
    long: 400, // Page transitions, celebrations
    slower: 500, // Complex animations
  },

  // Easing curves (CSS cubic-bezier)
  easing: {
    // Standard - Smooth & Fluid (default)
    standard: "cubic-bezier(0.4, 0, 0.2, 1)",
    // Enter - Decelerate (elements appearing)
    enter: "cubic-bezier(0, 0, 0.2, 1)",
    // Exit - Accelerate (elements leaving)
    exit: "cubic-bezier(0.4, 0, 1, 1)",
    // Bounce - Playful (celebrations only)
    bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    // Linear - Constant speed
    linear: "linear",
  },

  // Spring configs (for react-native-reanimated)
  spring: {
    // Default - Smooth & Fluid
    default: {
      damping: 38,
      stiffness: 280,
      mass: 1,
    },
    // Gentle - Slower, softer
    gentle: {
      damping: 50,
      stiffness: 200,
      mass: 1,
    },
    // Bouncy - Playful celebrations
    bouncy: {
      damping: 12,
      stiffness: 180,
      mass: 1,
    },
    // Stiff - Snappy feedback
    stiff: {
      damping: 50,
      stiffness: 400,
      mass: 1,
    },
  },

  // Pre-defined animation configs
  presets: {
    // Button press
    buttonPress: {
      duration: 150,
      easing: "standard",
      scale: 0.97,
    },
    // Card appear
    cardAppear: {
      duration: 300,
      easing: "enter",
      from: { opacity: 0, translateY: 8 },
      to: { opacity: 1, translateY: 0 },
    },
    // Modal enter
    modalEnter: {
      duration: 300,
      easing: "enter",
      from: { opacity: 0, scale: 0.95 },
      to: { opacity: 1, scale: 1 },
    },
    // Toast slide
    toastSlide: {
      duration: 200,
      easing: "enter",
    },
    // Achievement unlock (bouncy!)
    achievementUnlock: {
      duration: 400,
      easing: "bounce",
      spring: "bouncy",
    },
    // Streak milestone (bouncy!)
    streakMilestone: {
      duration: 300,
      easing: "bounce",
      spring: "bouncy",
    },
    // Progress update
    progressUpdate: {
      duration: 300,
      easing: "standard",
    },
  },
} as const;

// ============================================
// Z-INDEX SCALE
// ============================================

export const zIndex = {
  base: 0,
  card: 10,
  dropdown: 100,
  sticky: 200,
  header: 300,
  overlay: 400,
  modal: 500,
  toast: 600,
  tooltip: 700,
} as const;

// ============================================
// BREAKPOINTS (for responsive design)
// ============================================

export const breakpoints = {
  sm: 375, // Small phones
  md: 414, // Large phones
  lg: 768, // Tablets
  xl: 1024, // Large tablets
} as const;

// ============================================
// ICON SIZES
// ============================================

export const iconSize = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  "2xl": 32,
  "3xl": 40,
} as const;

// ============================================
// COMPONENT SIZES
// ============================================

export const componentSize = {
  // Touch targets (44pt minimum for accessibility)
  touchTarget: 44,
  touchTargetSmall: 36,

  // Avatars
  avatar: {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64,
    "2xl": 80,
  },

  // Buttons
  button: {
    sm: 32,
    md: 44,
    lg: 52,
  },

  // Inputs
  input: {
    sm: 36,
    md: 44,
    lg: 52,
  },

  // Tab bar
  tabBar: {
    height: 60,
    iconSize: 24,
  },

  // FAB (Floating Action Button)
  fab: {
    size: 56,
    iconSize: 24,
  },

  // Progress bars
  progressBar: {
    sm: 4,
    md: 6,
    lg: 8,
  },
} as const;

// ============================================
// THEME OBJECT (Combined)
// ============================================

export const theme = {
  colors,
  typography,
  spacing,
  radius,
  shadows,
  animation,
  zIndex,
  breakpoints,
  iconSize,
  componentSize,
} as const;

// ============================================
// THEME HOOK HELPER
// ============================================

export type ColorScheme = "light" | "dark";
export type ThemeColors = typeof colors.light;
export type ThemeShadows = typeof shadows.light;

export function useTheme() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return {
    colors: isDark ? colors.dark : colors.light,
    shadows: isDark ? shadows.dark : shadows.light,
    typography,
    spacing,
    radius,
    animation,
    zIndex,
    breakpoints,
    iconSize,
    componentSize,
    isDark,
  };
}

// ============================================
// TYPE EXPORTS
// ============================================

export type Theme = typeof theme;
export type Colors = typeof colors;
export type Typography = typeof typography;
export type Spacing = typeof spacing;
export type Radius = typeof radius;
export type Shadows = typeof shadows;
export type Animation = typeof animation;

export default theme;
