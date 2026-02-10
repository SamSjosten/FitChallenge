// src/components/create-challenge/StepInvite.tsx
// Step 3: Invite friends (social challenges only)
// CONTRACT: Uses profiles_public via useFriends hook

import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckIcon,
  UserIcon,
} from "react-native-heroicons/outline";
import type { FriendWithProfile } from "@/services/friends";
import type { StepInviteProps } from "./types";

interface FriendRowProps {
  friend: FriendWithProfile;
  isSelected: boolean;
  onToggle: () => void;
}

function FriendRow({ friend, isSelected, onToggle }: FriendRowProps) {
  const { colors, radius } = useAppTheme();
  const profile = friend.friend_profile;

  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.7}
      style={[styles.friendRow, isSelected && { backgroundColor: colors.primary.subtle }]}
    >
      {/* Avatar */}
      <View
        style={[styles.avatar, { backgroundColor: colors.background, borderRadius: radius.full }]}
      >
        <UserIcon size={20} color={colors.textMuted} />
      </View>

      {/* Name & username */}
      <View style={styles.friendInfo}>
        <Text style={[styles.friendName, { color: colors.textPrimary }]}>
          {profile.display_name || profile.username}
        </Text>
        <Text style={[styles.friendUsername, { color: colors.textSecondary }]}>
          @{profile.username}
        </Text>
      </View>

      {/* Checkbox */}
      <View
        style={[
          styles.checkbox,
          {
            borderRadius: radius.md,
            backgroundColor: isSelected ? colors.primary.main : "transparent",
            borderColor: isSelected ? colors.primary.main : colors.border,
          },
        ]}
      >
        {isSelected && <CheckIcon size={16} color="#FFFFFF" strokeWidth={3} />}
      </View>
    </TouchableOpacity>
  );
}

export function StepInvite({
  friends,
  friendsLoading,
  selectedFriendIds,
  setSelectedFriendIds,
  onNext,
  onBack,
}: StepInviteProps) {
  const { colors, radius } = useAppTheme();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return friends;
    const q = search.toLowerCase();
    return friends.filter((f) => {
      const p = f.friend_profile;
      return (
        p.username.toLowerCase().includes(q) || (p.display_name?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [friends, search]);

  const toggleFriend = (id: string) => {
    setSelectedFriendIds(
      selectedFriendIds.includes(id)
        ? selectedFriendIds.filter((fid) => fid !== id)
        : [...selectedFriendIds, id],
    );
  };

  if (friendsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading friends...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchWrap}>
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.xl,
            },
          ]}
        >
          <MagnifyingGlassIcon size={18} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search friends..."
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <XMarkIcon size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Friends List */}
      {friends.length === 0 ? (
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: colors.surface,
              borderRadius: radius["2xl"],
            },
          ]}
        >
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No friends yet. Add friends first to invite them to challenges.
          </Text>
        </View>
      ) : (
        <View
          style={[
            styles.listCard,
            {
              backgroundColor: colors.surface,
              borderRadius: radius["2xl"],
            },
          ]}
        >
          {filtered.length === 0 ? (
            <View style={styles.emptySearch}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No friends match your search
              </Text>
            </View>
          ) : (
            filtered.map((friend, idx) => (
              <React.Fragment key={friend.id}>
                {idx > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                <FriendRow
                  friend={friend}
                  isSelected={selectedFriendIds.includes(friend.friend_profile.id)}
                  onToggle={() => toggleFriend(friend.friend_profile.id)}
                />
              </React.Fragment>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingTop: 60,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "500",
  },
  searchWrap: {
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  listCard: {
    overflow: "hidden",
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 15,
    fontWeight: "600",
  },
  friendUsername: {
    fontSize: 13,
    fontWeight: "400",
    marginTop: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 68, // avatar width + gap
  },
  emptyCard: {
    padding: 32,
    alignItems: "center",
  },
  emptySearch: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
});
