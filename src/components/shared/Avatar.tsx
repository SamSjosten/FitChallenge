// src/components/shared/Avatar.tsx
// Reusable avatar component with initials fallback

import React from "react";
import { View, Text, StyleProp, ViewStyle } from "react-native";
import { radius } from "@/constants/theme";
import { useAppTheme } from "@/providers/ThemeProvider";

export interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  style?: StyleProp<ViewStyle>;
}

export function Avatar({ uri, name, size = "md", style }: AvatarProps) {
  const { colors, componentSize } = useAppTheme();
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
        style={[
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: radius.avatar,
            backgroundColor: colors.surfacePressed,
            overflow: "hidden",
          },
          style,
        ]}
      >
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
      style={[
        {
          width: avatarSize,
          height: avatarSize,
          borderRadius: radius.avatar,
          backgroundColor: colors.primary.subtle,
          justifyContent: "center",
          alignItems: "center",
        },
        style,
      ]}
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
