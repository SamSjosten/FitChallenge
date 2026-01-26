// app/(tabs)/_layout.tsx
// Tab navigation layout with centered FAB and Heroicons
// Design System v1.0

import React from "react";
import { Tabs, router } from "expo-router";
import { View, Pressable, Text, Platform } from "react-native";
import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import { useAppTheme } from "@/providers/ThemeProvider";
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

// Tab icon component using Heroicons
function TabIcon({
  name,
  focused,
  color,
}: {
  name: string;
  focused: boolean;
  color: string;
}) {
  const iconSize = 22;

  const icons: Record<
    string,
    { outline: React.ReactNode; solid: React.ReactNode }
  > = {
    home: {
      outline: <HomeIcon size={iconSize} color={color} />,
      solid: <HomeIconSolid size={iconSize} color={color} />,
    },
    compete: {
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
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      {focused ? icon.solid : icon.outline}
    </View>
  );
}

// Custom tab bar button wrapper with testID support
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
      style={[
        style,
        {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        },
      ]}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
    >
      {children}
    </Pressable>
  );
}

// Notification bell for header
function NotificationBell() {
  const { colors } = useAppTheme();
  const { data: unreadCount } = useUnreadNotificationCount();

  return (
    <Pressable
      testID={TestIDs.nav.notificationBell}
      style={{
        marginRight: 16,
        position: "relative",
        padding: 8,
      }}
      onPress={() => router.push("/notifications")}
    >
      <BellIcon size={22} color={colors.textSecondary} />
      {unreadCount !== undefined && unreadCount > 0 && (
        <View
          testID={TestIDs.nav.notificationBadge}
          style={{
            position: "absolute",
            top: 4,
            right: 2,
            backgroundColor: colors.error,
            borderRadius: 10,
            minWidth: 18,
            height: 18,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 4,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 11,
              fontFamily: "PlusJakartaSans_700Bold",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// Centered FAB create button
function CreateButton() {
  const { colors, shadows } = useAppTheme();

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Pressable
        testID={TestIDs.nav.createChallengeFab}
        style={({ pressed }) => ({
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primary.main,
          alignItems: "center",
          justifyContent: "center",
          marginTop: -16,
          transform: [{ scale: pressed ? 0.95 : 1 }],
          ...shadows.float,
          shadowColor: colors.primary.main,
        })}
        onPress={() => router.push("/challenge/create")}
      >
        <PlusIcon size={24} color="#FFFFFF" strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

export default function TabLayout() {
  const { colors } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary.main,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          // iOS 26 fix: borderTopWidth breaks touch - use shadow instead
          shadowColor: colors.border,
          shadowOffset: { width: 0, height: -1 },
          shadowOpacity: 1,
          shadowRadius: 0,
          elevation: 0,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: "PlusJakartaSans_500Medium",
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
          title: "Compete",
          tabBarButton: (props) => (
            <TabBarButton testID={TestIDs.nav.tabChallenges} props={props} />
          ),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="compete" focused={focused} color={color} />
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
