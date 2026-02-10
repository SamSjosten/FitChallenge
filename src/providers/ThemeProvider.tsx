// src/providers/ThemeProvider.tsx
// Theme provider with font loading and dark mode support

import React, { createContext, useContext, ReactNode } from "react";
import { useColorScheme, View, ActivityIndicator, StyleSheet } from "react-native";
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import {
  colors,
  shadows,
  typography,
  spacing,
  radius,
  animation,
  zIndex,
  breakpoints,
  iconSize,
  componentSize,
} from "@/constants/theme";

// =============================================================================
// THEME CONTEXT TYPES
// =============================================================================

// Define flexible interfaces instead of using literal types from `as const`
interface BrandColor {
  main: string;
  dark: string;
  light: string;
  subtle: string;
  contrast: string;
}

interface ThemeColors {
  primary: BrandColor;
  energy: BrandColor;
  achievement: BrandColor;
  success: string;
  warning: string;
  error: string;
  info: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  surfacePressed: string;
  border: string;
  borderStrong: string;
  borderFocus: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  overlay: string;
  scrim: string;
}

interface ShadowValue {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

interface ThemeShadows {
  none: string;
  sm: ShadowValue;
  card: ShadowValue;
  elevated: ShadowValue;
  button: ShadowValue;
  modal: ShadowValue;
  float: ShadowValue;
}

export interface ThemeContextValue {
  colors: ThemeColors;
  shadows: ThemeShadows;
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  animation: typeof animation;
  zIndex: typeof zIndex;
  breakpoints: typeof breakpoints;
  iconSize: typeof iconSize;
  componentSize: typeof componentSize;
  isDark: boolean;
  fontsLoaded: boolean;
}

// =============================================================================
// THEME CONTEXT
// =============================================================================

const ThemeContext = createContext<ThemeContextValue | null>(null);

// =============================================================================
// THEME PROVIDER
// =============================================================================

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  // Load fonts using expo-font's typed useFonts hook
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  const themeColors = isDark ? colors.dark : colors.light;
  const themeShadows = isDark ? shadows.dark : shadows.light;

  const value: ThemeContextValue = {
    colors: themeColors as ThemeColors,
    shadows: themeShadows as ThemeShadows,
    typography,
    spacing,
    radius,
    animation,
    zIndex,
    breakpoints,
    iconSize,
    componentSize,
    isDark,
    fontsLoaded,
  };

  // Show loading screen while fonts load
  if (!fontsLoaded) {
    return (
      <View style={[styles.loading, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.primary.main} />
      </View>
    );
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// =============================================================================
// USE THEME HOOK
// =============================================================================

export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within a ThemeProvider");
  }
  return context;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
