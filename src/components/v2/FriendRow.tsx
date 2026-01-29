// src/components/v2/FriendRow.tsx
// V2 Friend row component for friends list
// Design System v2.0

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import { Avatar } from "@/components/ui";
import {
  FireIcon,
  UserPlusIcon,
  CheckIcon,
  XMarkIcon,
} from "react-native-heroicons/outline";
import type { ProfilePublic } from "@/types/database";

// Friend row for accepted friends
export interface FriendRowProps {
  friend: {
    id: string;
    friend_profile: ProfilePublic;
  };
  onPress?: () => void;
  onRemove?: () => void;
}

export function FriendRow({ friend, onPress, onRemove }: FriendRowProps) {
  const { colors, spacing, radius } = useAppTheme();
  const profile = friend.friend_profile;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.md,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <Avatar
        uri={profile.avatar_url}
        name={profile.display_name || profile.username}
        size="md"
      />
      <View style={styles.content}>
        <Text style={[styles.name, { color: colors.textPrimary }]}>
          {profile.display_name || profile.username}
        </Text>
        <Text style={[styles.username, { color: colors.textMuted }]}>
          @{profile.username}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// Friend request row for pending requests
export interface FriendRequestRowProps {
  request: {
    id: string;
    requester: ProfilePublic;
  };
  onAccept: (friendshipId: string) => void;
  onDecline: (friendshipId: string) => void;
  loading?: boolean;
}

export function FriendRequestRow({
  request,
  onAccept,
  onDecline,
  loading = false,
}: FriendRequestRowProps) {
  const { colors, spacing, radius } = useAppTheme();
  const profile = request.requester;

  return (
    <View
      style={[
        styles.requestContainer,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.md,
        },
      ]}
    >
      <View style={styles.requestHeader}>
        <Avatar
          uri={profile.avatar_url}
          name={profile.display_name || profile.username}
          size="md"
        />
        <View style={styles.content}>
          <Text style={[styles.name, { color: colors.textPrimary }]}>
            {profile.display_name || profile.username}
          </Text>
          <Text style={[styles.username, { color: colors.textMuted }]}>
            @{profile.username}
          </Text>
        </View>
      </View>

      <View
        style={[styles.actions, { marginTop: spacing.md, gap: spacing.sm }]}
      >
        <TouchableOpacity
          style={[
            styles.actionButton,
            {
              backgroundColor: colors.backgroundAlt,
              borderRadius: radius.lg,
            },
          ]}
          onPress={() => onDecline(request.id)}
          disabled={loading}
          activeOpacity={0.7}
        >
          <XMarkIcon size={18} color={colors.textSecondary} />
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>
            Decline
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            {
              backgroundColor: colors.primary.main,
              borderRadius: radius.lg,
            },
          ]}
          onPress={() => onAccept(request.id)}
          disabled={loading}
          activeOpacity={0.7}
        >
          <CheckIcon size={18} color="#FFFFFF" />
          <Text style={[styles.actionText, { color: "#FFFFFF" }]}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Search result row for adding friends
export interface SearchResultRowProps {
  user: ProfilePublic;
  onSendRequest: (userId: string) => void;
  loading?: boolean;
  alreadySent?: boolean;
}

export function SearchResultRow({
  user,
  onSendRequest,
  loading = false,
  alreadySent = false,
}: SearchResultRowProps) {
  const { colors, spacing, radius } = useAppTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.md,
        },
      ]}
    >
      <Avatar
        uri={user.avatar_url}
        name={user.display_name || user.username}
        size="md"
      />
      <View style={styles.content}>
        <Text style={[styles.name, { color: colors.textPrimary }]}>
          {user.display_name || user.username}
        </Text>
        <Text style={[styles.username, { color: colors.textMuted }]}>
          @{user.username}
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.addButton,
          {
            backgroundColor: alreadySent
              ? colors.backgroundAlt
              : colors.primary.main,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
        ]}
        onPress={() => onSendRequest(user.id)}
        disabled={loading || alreadySent}
        activeOpacity={0.7}
      >
        {alreadySent ? (
          <Text style={[styles.addButtonText, { color: colors.textMuted }]}>
            Sent
          </Text>
        ) : (
          <>
            <UserPlusIcon size={16} color="#FFFFFF" />
            <Text style={[styles.addButtonText, { color: "#FFFFFF" }]}>
              Add
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  username: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    marginTop: 2,
  },
  // Request styles
  requestContainer: {},
  requestHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  actions: {
    flexDirection: "row",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  // Add button styles
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addButtonText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
});
