// app/(tabs-v2)/_layout.tsx
// V2 Tab navigation layout with centered FAB
// Design System v2.0 - Based on prototype
//
// Key differences from v1:
// - Larger icons (24px vs 22px)
// - Cleaner tab bar with subtle border
// - Updated FAB positioning (-24px margin)
// - "Challenges" label instead of "Compete"

import React, { useEffect } from "react";
import { Tabs, router } from "expo-router";
import { View, Pressable, Text, Platform, StyleSheet } from "react-native";
import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import { useAppTheme } from "@/providers/ThemeProvider";
import { useNavigationStore } from "@/stores/navigationStore";
import { TestIDs } from "@/constants/testIDs";
import {
  HomeIcon,
  TrophyIcon,
  UsersIcon,
  UserIcon,
  PlusIcon,
  BellIcon,
} from "react-native-heroicons/outline";
import {
  HomeIcon as HomeIconSolid,
  TrophyIcon as TrophyIconSolid,
  UsersIcon as UsersIconSolid,
  UserIcon as UserIconSolid,
} from "react-native-heroicons/solid";

// =============================================================================
// TAB ICON COMPONENT
// =============================================================================

function TabIcon({
  name,
  focused,
  color,
}: {
  name: string;
  focused: boolean;
  color: string;
}) {
  const iconSize = 24; // Larger for v2

  const icons: Record<
    string,
    { outline: React.ReactNode; solid: React.ReactNode }
  > = {
    home: {
      outline: <HomeIcon size={iconSize} color={color} />,
      solid: <HomeIconSolid size={iconSize} color={color} />,
    },
    challenges: {
      outline: <TrophyIcon size={iconSize} color={color} />,
      solid: <TrophyIconSolid size={iconSize} color={color} />,
    },
    friends: {
      outline: <UsersIcon size={iconSize} color={color} />,
      solid: <UsersIconSolid size={iconSize} color={color} />,
    },
    profile: {
      outline: <UserIcon size={iconSize} color={color} />,
      solid: <UserIconSolid size={iconSize} color={color} />,
    },
  };

  const icon = icons[name];
  if (!icon) return null;

  return (
    <View style={styles.tabIconContainer}>
      {focused ? icon.solid : icon.outline}
    </View>
  );
}

// =============================================================================
// TAB BAR BUTTON
// =============================================================================

function TabBarButton({
  testID,
  props,
}: {
  testID: string;
  props: BottomTabBarButtonProps;
}) {
  const { children, onPress, accessibilityState, style } = props;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[style, styles.tabBarButton]}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
    >
      {children}
    </Pressable>
  );
}

// =============================================================================
// NOTIFICATION BELL
// =============================================================================

function NotificationBell() {
  const { colors } = useAppTheme();
  const { data: unreadCount } = useUnreadNotificationCount();

  return (
    <Pressable
      testID={TestIDs.nav.notificationBell}
      style={styles.notificationBell}
      onPress={() => router.push("/notifications")}
    >
      <BellIcon size={24} color={colors.textSecondary} />
      {unreadCount !== undefined && unreadCount > 0 && (
        <View
          testID={TestIDs.nav.notificationBadge}
          style={[styles.notificationBadge, { backgroundColor: colors.error }]}
        >
          <Text style={styles.notificationBadgeText}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// =============================================================================
// CREATE BUTTON (Floating FAB)
// =============================================================================

function CreateButton() {
  const { colors, shadows } = useAppTheme();

  return (
    <View style={styles.createButtonContainer}>
      <Pressable
        testID={TestIDs.nav.createChallengeFab}
        style={({ pressed }) => [
          styles.createButton,
          {
            backgroundColor: colors.primary.main,
            transform: [{ scale: pressed ? 0.95 : 1 }],
            ...shadows.float,
            shadowColor: colors.primary.main,
          },
        ]}
        onPress={() => router.push("/challenge/create")}
      >
        <PlusIcon size={28} color="#FFFFFF" strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

// =============================================================================
// TAB LAYOUT
// =============================================================================

export default function TabLayoutV2() {
  const { colors } = useAppTheme();

  // Clear navigation lock on mount - this ensures auth screen's lock is released
  // once we've actually navigated to tabs (deterministic, no timing hacks)
  const setAuthHandlingNavigation = useNavigationStore(
    (state) => state.setAuthHandlingNavigation,
  );

  useEffect(() => {
    // Clear any navigation lock from auth flow
    console.log("🏠 [TabsLayout] Mounted, clearing navigation lock");
    setAuthHandlingNavigation(false);
  }, [setAuthHandlingNavigation]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary.main,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 24 : 12,
          height: Platform.OS === "ios" ? 88 : 68,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: "PlusJakartaSans_500Medium",
          marginTop: 4,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTitleStyle: {
          fontFamily: "PlusJakartaSans_700Bold",
          color: colors.textPrimary,
          fontSize: 18,
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarButton: (props) => (
            <TabBarButton testID={TestIDs.nav.tabHome} props={props} />
          ),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="home" focused={focused} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="challenges"
        options={{
          title: "Challenges",
          tabBarButton: (props) => (
            <TabBarButton testID={TestIDs.nav.tabChallenges} props={props} />
          ),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="challenges" focused={focused} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "",
          tabBarButton: () => <CreateButton />,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push("/challenge/create");
          },
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: "Friends",
          tabBarButton: (props) => (
            <TabBarButton testID={TestIDs.nav.tabFriends} props={props} />
          ),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="friends" focused={focused} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarButton: (props) => (
            <TabBarButton testID={TestIDs.nav.tabProfile} props={props} />
          ),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="profile" focused={focused} color={color} />
          ),
          headerShown: false,
        }}
      />
    </Tabs>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  tabIconContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  tabBarButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBell: {
    marginRight: 16,
    position: "relative",
    padding: 8,
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
  createButtonContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  createButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -24,
  },
});
