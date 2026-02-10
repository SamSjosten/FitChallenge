// src/components/ScreenContainer.tsx
// ============================================
// UNIFIED SCREEN CONTAINER
// ============================================
// Solves UI scaling issues by providing consistent:
// - Safe area handling (top/bottom)
// - Tab bar clearance
// - Header patterns
// - Pull-to-refresh support
// - Theme-aware backgrounds

import React, { ReactNode } from "react";
import {
  View,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ViewStyle,
  StatusBar,
  Platform,
  Text,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets, Edge, SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/providers/ThemeProvider";
import { componentSize, spacing } from "@/constants/theme";
import { BellIcon } from "react-native-heroicons/outline";
import { router } from "expo-router";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";

// ============================================
// LAYOUT CONSTANTS
// ============================================

export const LAYOUT = {
  // Tab bar height (matches tabs/_layout.tsx)
  TAB_BAR_HEIGHT: componentSize.tabBar.height,

  // Extra padding below tab bar for comfortable scrolling
  TAB_BAR_BOTTOM_OFFSET: 20,

  // Total bottom padding needed for content above tab bar
  get BOTTOM_INSET() {
    return this.TAB_BAR_HEIGHT + this.TAB_BAR_BOTTOM_OFFSET;
  },

  // Screen horizontal padding
  SCREEN_PADDING_HORIZONTAL: spacing.lg,

  // Screen top padding (when using custom header)
  SCREEN_PADDING_TOP: spacing.lg,
} as const;

// ============================================
// TYPES
// ============================================

interface ScreenContainerProps {
  children: ReactNode;

  /**
   * Test ID for E2E testing
   */
  testID?: string;

  /**
   * Whether to wrap content in ScrollView
   * @default true
   */
  scrollable?: boolean;

  /**
   * Pull-to-refresh handler
   * When provided, enables pull-to-refresh on ScrollView
   */
  onRefresh?: () => Promise<void>;

  /**
   * Which edges to apply safe area insets
   * @default ['top'] for custom header screens, [] for default header screens
   */
  edges?: Edge[];

  /**
   * Custom header component (rendered inside safe area)
   * When provided, the screen manages its own header
   */
  header?: ReactNode;

  /**
   * Additional style for the outer container
   */
  style?: ViewStyle;

  /**
   * Additional style for the content area
   */
  contentStyle?: ViewStyle;

  /**
   * Whether this screen is inside tab navigation
   * Affects bottom padding calculation
   * @default true
   */
  inTabs?: boolean;

  /**
   * Disable automatic bottom padding for tab bar
   * Useful for screens with fixed bottom elements
   * @default false
   */
  noBottomPadding?: boolean;

  /**
   * Custom bottom padding (overrides automatic calculation)
   */
  bottomPadding?: number;
}

// ============================================
// COMPONENT
// ============================================

export function ScreenContainer({
  children,
  testID,
  scrollable = true,
  onRefresh,
  edges = ["top"],
  header,
  style,
  contentStyle,
  inTabs = true,
  noBottomPadding = false,
  bottomPadding: customBottomPadding,
}: ScreenContainerProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = React.useState(false);

  // Calculate bottom padding
  const bottomPadding = React.useMemo(() => {
    if (noBottomPadding) return 0;
    if (customBottomPadding !== undefined) return customBottomPadding;

    if (inTabs) {
      // In tabs: need to clear tab bar + bottom safe area
      return LAYOUT.BOTTOM_INSET + insets.bottom;
    }

    // Outside tabs: just safe area
    return insets.bottom + spacing.lg;
  }, [noBottomPadding, customBottomPadding, inTabs, insets.bottom]);

  // Handle refresh
  const handleRefresh = React.useCallback(async () => {
    if (!onRefresh) return;

    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  // Content wrapper based on scrollable prop
  const renderContent = () => {
    if (scrollable) {
      return (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomPadding },
            contentStyle,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary.main}
                colors={[colors.primary.main]}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      );
    }

    return (
      <View style={[styles.staticContent, { paddingBottom: bottomPadding }, contentStyle]}>
        {children}
      </View>
    );
  };

  return (
    <SafeAreaView
      testID={testID}
      edges={edges}
      style={[styles.container, { backgroundColor: colors.background }, style]}
    >
      <StatusBar
        barStyle={colors.textPrimary === "#FAFAFA" ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />
      {header}
      {renderContent()}
    </SafeAreaView>
  );
}

// ============================================
// SCREEN HEADER COMPONENT
// ============================================

interface ScreenHeaderProps {
  /**
   * Main title text
   */
  title: string;

  /**
   * Optional subtitle text
   */
  subtitle?: string;

  /**
   * Show notification bell icon
   * @default false
   */
  showNotifications?: boolean;

  /**
   * Custom right action component
   */
  rightAction?: ReactNode;

  /**
   * Custom left action component
   */
  leftAction?: ReactNode;

  /**
   * Large title style (bigger, bolder)
   * @default true
   */
  largeTitle?: boolean;
}

export function ScreenHeader({
  title,
  subtitle,
  showNotifications = false,
  rightAction,
  leftAction,
  largeTitle = true,
}: ScreenHeaderProps) {
  const { colors, spacing: themeSpacing, typography, iconSize } = useAppTheme();
  const { data: unreadCount } = useUnreadNotificationCount();

  return (
    <View
      style={[
        styles.header,
        {
          paddingHorizontal: LAYOUT.SCREEN_PADDING_HORIZONTAL,
          paddingTop: themeSpacing.md,
          paddingBottom: themeSpacing.md,
        },
      ]}
    >
      {/* Left Section */}
      <View style={styles.headerLeft}>{leftAction}</View>

      {/* Center/Title Section */}
      <View style={styles.headerCenter}>
        <Text
          style={[
            styles.headerTitle,
            {
              fontSize: largeTitle
                ? typography.textStyles.display.fontSize
                : typography.textStyles.headline.fontSize,
              color: colors.textPrimary,
            },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            style={[
              styles.headerSubtitle,
              {
                fontSize: typography.textStyles.body.fontSize,
                color: colors.textSecondary,
              },
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>

      {/* Right Section */}
      <View style={styles.headerRight}>
        {rightAction}
        {showNotifications && (
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => router.push("/notifications")}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <BellIcon size={iconSize.md} color={colors.textSecondary} />
            {unreadCount !== undefined && unreadCount > 0 && (
              <View style={[styles.notificationBadge, { backgroundColor: colors.error }]}>
                <Text style={styles.notificationBadgeText}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ============================================
// SECTION COMPONENTS
// ============================================

interface ScreenSectionProps {
  children: ReactNode;
  /**
   * Add horizontal padding (matches screen padding)
   * @default true
   */
  padded?: boolean;
  /**
   * Add bottom margin
   * @default true
   */
  spaced?: boolean;
  style?: ViewStyle;
}

/**
 * Use for grouping content sections within ScreenContainer
 */
export function ScreenSection({
  children,
  padded = true,
  spaced = true,
  style,
}: ScreenSectionProps) {
  return (
    <View
      style={[
        padded && { paddingHorizontal: LAYOUT.SCREEN_PADDING_HORIZONTAL },
        spaced && { marginBottom: spacing.xl },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  staticContent: {
    flex: 1,
  },

  // Header styles
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    minWidth: 40,
    alignItems: "flex-start",
  },
  headerCenter: {
    flex: 1,
    alignItems: "flex-start",
  },
  headerRight: {
    minWidth: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  headerTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
  },
  headerSubtitle: {
    fontFamily: "PlusJakartaSans_500Medium",
    marginTop: 2,
  },

  // Notification button
  notificationButton: {
    padding: 8,
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: 4,
    right: 2,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
  },
});

// ============================================
// HOOK: useScreenLayout
// ============================================

/**
 * Hook to get layout dimensions and safe area insets
 * Useful for custom layouts that need these values
 */
export function useScreenLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  return {
    insets,
    layout: LAYOUT,
    bottomPadding: LAYOUT.BOTTOM_INSET + insets.bottom,
    topPadding: insets.top,
    horizontalPadding: LAYOUT.SCREEN_PADDING_HORIZONTAL,
    colors,
  };
}

export default ScreenContainer;
