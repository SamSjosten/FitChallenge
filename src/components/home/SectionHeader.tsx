// src/components/home/SectionHeader.tsx
// Styled section header for home screen sections
// Design System - Based on home screen mockup
//
// Features:
// - Accent bar (colored left border)
// - Icon + Title + Count badge
// - Variant colors: primary (green), warning (amber), muted (gray)
// - Optional right-side content (children)

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";

// ============================================================================
// TYPES
// ============================================================================
export type SectionVariant = "primary" | "warning" | "muted";

export interface SectionHeaderProps {
  title: string;
  count?: number;
  icon?: React.ReactNode;
  variant?: SectionVariant;
  children?: React.ReactNode; // Right-side content (filter, see all link, etc.)
}

// ============================================================================
// COMPONENT
// ============================================================================
export function SectionHeader({
  title,
  count,
  icon,
  variant = "primary",
  children,
}: SectionHeaderProps) {
  const { colors, spacing, radius } = useAppTheme();

  // Color based on variant
  const accentColor =
    variant === "warning"
      ? colors.warning
      : variant === "muted"
        ? colors.textMuted
        : colors.primary.main;

  const badgeBackground =
    variant === "warning"
      ? `${colors.warning}20`
      : variant === "muted"
        ? `${colors.textMuted}15`
        : `${colors.primary.main}20`;

  return (
    <View style={styles.container}>
      {/* Left section: accent bar + icon + title + count */}
      <View style={styles.leftSection}>
        {/* Accent bar */}
        <View
          style={[
            styles.accentBar,
            {
              backgroundColor: accentColor,
              borderRadius: 2,
            },
          ]}
        />

        {/* Icon (optional) */}
        {icon && <View style={styles.iconWrapper}>{icon}</View>}

        {/* Title */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {title}
        </Text>

        {/* Count badge (optional) */}
        {count !== undefined && count > 0 && (
          <View
            style={[
              styles.countBadge,
              {
                backgroundColor: badgeBackground,
                borderRadius: radius.md,
              },
            ]}
          >
            <Text style={[styles.countText, { color: accentColor }]}>
              {count}
            </Text>
          </View>
        )}
      </View>

      {/* Right section (optional - for filter button, see all link, etc.) */}
      {children && <View style={styles.rightSection}>{children}</View>}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  accentBar: {
    width: 4,
    height: 18,
  },
  iconWrapper: {},
  title: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  rightSection: {},
});
