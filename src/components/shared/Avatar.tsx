// src/components/shared/Avatar.tsx
// Reusable avatar component with initials fallback

import React, { useState } from "react";
import { View, Text, Image, StyleProp, ViewStyle } from "react-native";
import { radius } from "@/constants/theme";
import { useAppTheme } from "@/providers/ThemeProvider";

export interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  style?: StyleProp<ViewStyle>;
}

function AvatarInner({ uri, name, size = "md", style }: AvatarProps) {
  const { colors, componentSize } = useAppTheme();
  const avatarSize = componentSize.avatar[size];
  const [imageFailed, setImageFailed] = useState(false);

  const getInitials = (name?: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const initialsView = (
    <View
      style={{
        flex: 1,
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

  if (uri && !imageFailed) {
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
        <Image
          source={{ uri }}
          style={{ width: avatarSize, height: avatarSize }}
          onError={() => setImageFailed(true)}
        />
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
      {initialsView}
    </View>
  );
}

export const Avatar = React.memo(AvatarInner);
