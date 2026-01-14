// app/(tabs)/friends.tsx
// Friends screen - Design System v1.0
// Matches mockup: search, requests, friends list with online status

import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Modal,
  Alert,
  TextInput,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  useFriends,
  usePendingFriendRequests,
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useRemoveFriend,
  useSendFriendRequest,
} from "@/hooks/useFriends";
import { authService } from "@/services/auth";
import { Button, Card, LoadingScreen, Avatar } from "@/components/ui";
import { useAppTheme } from "@/providers/ThemeProvider";
import {
  MagnifyingGlassIcon,
  ChevronRightIcon,
  UserPlusIcon,
  XMarkIcon,
} from "react-native-heroicons/outline";
import type { ProfilePublic } from "@/types/database";

export default function FriendsScreen() {
  const { colors, spacing, radius, typography } = useAppTheme();

  const {
    data: friends,
    isLoading: loadingFriends,
    refetch: refetchFriends,
  } = useFriends();
  const {
    data: pendingRequests,
    isLoading: loadingRequests,
    refetch: refetchRequests,
  } = usePendingFriendRequests();

  const acceptRequest = useAcceptFriendRequest();
  const declineRequest = useDeclineFriendRequest();
  const removeFriend = useRemoveFriend();
  const sendRequest = useSendFriendRequest();

  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfilePublic[]>([]);
  const [searching, setSearching] = useState(false);

  // Auto-refresh on focus
  useFocusEffect(
    React.useCallback(() => {
      refetchFriends();
      refetchRequests();
    }, [refetchFriends, refetchRequests])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchFriends(), refetchRequests()]);
    setRefreshing(false);
  };

  const handleSearch = async () => {
    if (searchQuery.length < 2) return;
    setSearching(true);
    try {
      const results = await authService.searchUsers(searchQuery);
      // Filter out existing friends and pending requests
      const friendIds = new Set(friends?.map((f) => f.friend_profile.id) || []);
      const pendingIds = new Set(
        pendingRequests?.map((r) => r.requester.id) || []
      );
      setSearchResults(
        results.filter((r) => !friendIds.has(r.id) && !pendingIds.has(r.id))
      );
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (userId: string) => {
    try {
      await sendRequest.mutateAsync(userId);
      Alert.alert("Request Sent!", "Friend request has been sent");
      setSearchResults((prev) => prev.filter((r) => r.id !== userId));
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to send request");
    }
  };

  const handleAccept = async (friendshipId: string) => {
    try {
      await acceptRequest.mutateAsync(friendshipId);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to accept request");
    }
  };

  const handleDecline = async (friendshipId: string) => {
    try {
      await declineRequest.mutateAsync(friendshipId);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to decline request");
    }
  };

  const handleRemoveFriend = (friendshipId: string, friendName: string) => {
    Alert.alert(
      "Remove Friend",
      `Are you sure you want to remove ${friendName} from your friends?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeFriend.mutateAsync(friendshipId);
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to remove friend");
            }
          },
        },
      ]
    );
  };

  if (loadingFriends && loadingRequests && !refreshing) {
    return <LoadingScreen />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary.main}
          />
        }
      >
        {/* Header */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.md,
          }}
        >
          <Text
            style={{
              fontSize: typography.fontSize["xl"],
              fontFamily: "PlusJakartaSans_700Bold",
              color: colors.textPrimary,
            }}
          >
            Friends
          </Text>
        </View>

        {/* Search Bar */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            marginBottom: spacing.xl,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              backgroundColor: colors.surface,
              borderRadius: radius.input,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <MagnifyingGlassIcon size={18} color={colors.textMuted} />
            <TextInput
              style={{
                flex: 1,
                fontSize: typography.fontSize.base,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.textPrimary,
              }}
              placeholder="Search friends..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
          </View>
        </View>

        {/* Friend Requests */}
        {pendingRequests && pendingRequests.length > 0 && (
          <View
            style={{
              paddingHorizontal: spacing.lg,
              marginBottom: spacing.xl,
            }}
          >
            <Text
              style={{
                fontSize: typography.fontSize.xs,
                fontFamily: "PlusJakartaSans_600SemiBold",
                color: colors.textSecondary,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: spacing.sm,
              }}
            >
              Friend Requests
            </Text>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.card,
                overflow: "hidden",
                ...{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.08,
                  shadowRadius: 3,
                  elevation: 2,
                },
              }}
            >
              {pendingRequests.map((request, index) => (
                <View
                  key={request.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: spacing.md,
                    gap: spacing.sm,
                    borderBottomWidth:
                      index < pendingRequests.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Avatar
                    name={
                      request.requester.display_name ||
                      request.requester.username
                    }
                    size="md"
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: typography.fontSize.base,
                        fontFamily: "PlusJakartaSans_500Medium",
                        color: colors.textPrimary,
                      }}
                    >
                      {request.requester.display_name ||
                        request.requester.username}
                    </Text>
                    <Text
                      style={{
                        fontSize: typography.fontSize.xs,
                        fontFamily: "PlusJakartaSans_500Medium",
                        color: colors.textMuted,
                      }}
                    >
                      @{request.requester.username}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <TouchableOpacity
                      style={{
                        backgroundColor: colors.primary.main,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.button,
                      }}
                      onPress={() => handleAccept(request.id)}
                    >
                      <Text
                        style={{
                          fontSize: typography.fontSize.sm,
                          fontFamily: "PlusJakartaSans_600SemiBold",
                          color: "#FFFFFF",
                        }}
                      >
                        Accept
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        backgroundColor: "transparent",
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.button,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                      onPress={() => handleDecline(request.id)}
                    >
                      <Text
                        style={{
                          fontSize: typography.fontSize.sm,
                          fontFamily: "PlusJakartaSans_500Medium",
                          color: colors.textMuted,
                        }}
                      >
                        Decline
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Friends List */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Text
            style={{
              fontSize: typography.fontSize.xs,
              fontFamily: "PlusJakartaSans_600SemiBold",
              color: colors.textSecondary,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: spacing.sm,
            }}
          >
            Your Friends ({friends?.length || 0})
          </Text>

          {friends && friends.length === 0 ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.card,
                padding: spacing.xl,
                alignItems: "center",
                ...{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.08,
                  shadowRadius: 3,
                  elevation: 2,
                },
              }}
            >
              <UserPlusIcon size={40} color={colors.textMuted} />
              <Text
                style={{
                  fontSize: typography.fontSize.md,
                  fontFamily: "PlusJakartaSans_600SemiBold",
                  color: colors.textPrimary,
                  marginTop: spacing.md,
                }}
              >
                No friends yet
              </Text>
              <Text
                style={{
                  fontSize: typography.fontSize.sm,
                  fontFamily: "PlusJakartaSans_500Medium",
                  color: colors.textMuted,
                  textAlign: "center",
                  marginTop: spacing.xs,
                }}
              >
                Add friends to challenge them!
              </Text>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.card,
                overflow: "hidden",
                ...{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.08,
                  shadowRadius: 3,
                  elevation: 2,
                },
              }}
            >
              {friends?.map((friend, index) => (
                <Pressable
                  key={friend.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: spacing.md,
                    gap: spacing.sm,
                    borderBottomWidth:
                      index < (friends?.length || 0) - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                  onLongPress={() =>
                    handleRemoveFriend(
                      friend.id,
                      friend.friend_profile.display_name ||
                        friend.friend_profile.username
                    )
                  }
                >
                  {/* Avatar with online indicator */}
                  <View style={{ position: "relative" }}>
                    <Avatar
                      name={
                        friend.friend_profile.display_name ||
                        friend.friend_profile.username
                      }
                      size="md"
                    />
                    {/* Online indicator - random for demo */}
                    <View
                      style={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor:
                          Math.random() > 0.5
                            ? colors.success
                            : colors.textMuted,
                        borderWidth: 2,
                        borderColor: colors.surface,
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: typography.fontSize.base,
                        fontFamily: "PlusJakartaSans_500Medium",
                        color: colors.textPrimary,
                      }}
                    >
                      {friend.friend_profile.display_name ||
                        friend.friend_profile.username}
                    </Text>
                    <Text
                      style={{
                        fontSize: typography.fontSize.xs,
                        fontFamily: "PlusJakartaSans_500Medium",
                        color: colors.textMuted,
                      }}
                    >
                      {Math.floor(Math.random() * 5) + 1} mutual challenges
                    </Text>
                  </View>
                  <ChevronRightIcon size={18} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Add Friend Button */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.xl,
          }}
        >
          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.sm,
              backgroundColor: "transparent",
              borderWidth: 1,
              borderColor: colors.primary.main,
              borderRadius: radius.button,
              paddingVertical: spacing.md,
            }}
            onPress={() => setShowAddModal(true)}
          >
            <UserPlusIcon size={18} color={colors.primary.main} />
            <Text
              style={{
                fontSize: typography.fontSize.base,
                fontFamily: "PlusJakartaSans_600SemiBold",
                color: colors.primary.main,
              }}
            >
              Add Friends
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Add Friend Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: "center",
            padding: spacing.xl,
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.modal,
              padding: spacing.xl,
              maxHeight: "80%",
            }}
          >
            {/* Modal Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: spacing.lg,
              }}
            >
              <Text
                style={{
                  fontSize: typography.fontSize.lg,
                  fontFamily: "PlusJakartaSans_700Bold",
                  color: colors.textPrimary,
                }}
              >
                Add Friend
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
              >
                <XMarkIcon size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View
              style={{
                flexDirection: "row",
                gap: spacing.sm,
                marginBottom: spacing.lg,
              }}
            >
              <View
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  backgroundColor: colors.background,
                  borderRadius: radius.input,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <MagnifyingGlassIcon size={18} color={colors.textMuted} />
                <TextInput
                  style={{
                    flex: 1,
                    fontSize: typography.fontSize.base,
                    fontFamily: "PlusJakartaSans_500Medium",
                    color: colors.textPrimary,
                  }}
                  placeholder="Search by username"
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                  autoFocus
                />
              </View>
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary.main,
                  paddingHorizontal: spacing.lg,
                  borderRadius: radius.button,
                  justifyContent: "center",
                }}
                onPress={handleSearch}
              >
                <Text
                  style={{
                    fontSize: typography.fontSize.sm,
                    fontFamily: "PlusJakartaSans_600SemiBold",
                    color: "#FFFFFF",
                  }}
                >
                  Search
                </Text>
              </TouchableOpacity>
            </View>

            {/* Search Results */}
            {searchResults.length === 0 &&
              searchQuery.length >= 2 &&
              !searching && (
                <Text
                  style={{
                    fontSize: typography.fontSize.sm,
                    fontFamily: "PlusJakartaSans_500Medium",
                    color: colors.textMuted,
                    textAlign: "center",
                    marginBottom: spacing.lg,
                  }}
                >
                  No users found
                </Text>
              )}

            <ScrollView style={{ maxHeight: 300 }}>
              {searchResults.map((user) => (
                <View
                  key={user.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: spacing.md,
                    backgroundColor: colors.background,
                    borderRadius: radius.cardInner,
                    marginBottom: spacing.sm,
                  }}
                >
                  <Avatar name={user.display_name || user.username} size="sm" />
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text
                      style={{
                        fontSize: typography.fontSize.base,
                        fontFamily: "PlusJakartaSans_500Medium",
                        color: colors.textPrimary,
                      }}
                    >
                      {user.display_name || user.username}
                    </Text>
                    <Text
                      style={{
                        fontSize: typography.fontSize.sm,
                        fontFamily: "PlusJakartaSans_500Medium",
                        color: colors.textMuted,
                      }}
                    >
                      @{user.username}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={{
                      backgroundColor: colors.primary.main,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      borderRadius: radius.button,
                    }}
                    onPress={() => handleSendRequest(user.id)}
                  >
                    <Text
                      style={{
                        fontSize: typography.fontSize.sm,
                        fontFamily: "PlusJakartaSans_600SemiBold",
                        color: "#FFFFFF",
                      }}
                    >
                      Add
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
