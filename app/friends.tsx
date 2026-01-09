// app/(tabs)/friends.tsx
// Friends screen - view friends, requests, and add new friends

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Modal,
  Alert,
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
import {
  Button,
  Card,
  Input,
  LoadingScreen,
  EmptyState,
} from "@/components/ui";
import type { ProfilePublic } from "@/types/database";

export default function FriendsScreen() {
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header with Add Button */}
      <View style={styles.header}>
        <Text style={styles.title}>Friends</Text>
        <Button
          title="+ Add"
          variant="outline"
          size="small"
          onPress={() => setShowAddModal(true)}
        />
      </View>

      {/* Pending Requests */}
      {pendingRequests && pendingRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Friend Requests ({pendingRequests.length})
          </Text>
          {pendingRequests.map((request) => (
            <Card key={request.id} style={styles.requestCard}>
              <View style={styles.requestInfo}>
                <Text style={styles.requestName}>
                  {request.requester.display_name || request.requester.username}
                </Text>
                <Text style={styles.requestUsername}>
                  @{request.requester.username}
                </Text>
              </View>
              <View style={styles.requestActions}>
                <Button
                  title="Accept"
                  size="small"
                  onPress={() => handleAccept(request.id)}
                  loading={acceptRequest.isPending}
                  style={styles.acceptButton}
                />
                <Button
                  title="Decline"
                  variant="outline"
                  size="small"
                  onPress={() => handleDecline(request.id)}
                  loading={declineRequest.isPending}
                />
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* Friends List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Your Friends ({friends?.length || 0})
        </Text>

        {friends && friends.length === 0 && (
          <EmptyState
            title="No friends yet"
            message="Add friends to challenge them to fitness competitions!"
            actionLabel="Add Friend"
            onAction={() => setShowAddModal(true)}
          />
        )}

        {friends?.map((friend) => (
          <Card key={friend.id} style={styles.friendCard}>
            <View style={styles.friendInfo}>
              <Text style={styles.friendName}>
                {friend.friend_profile.display_name ||
                  friend.friend_profile.username}
              </Text>
              <Text style={styles.friendUsername}>
                @{friend.friend_profile.username}
              </Text>
            </View>
            <Button
              title="Remove"
              variant="outline"
              size="small"
              onPress={() =>
                handleRemoveFriend(
                  friend.id,
                  friend.friend_profile.display_name ||
                    friend.friend_profile.username
                )
              }
              style={styles.removeButton}
            />
          </Card>
        ))}
      </View>

      {/* Add Friend Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Friend</Text>
            <View style={styles.searchRow}>
              <Input
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by username"
                containerStyle={styles.searchInput}
              />
              <Button
                title="Search"
                size="small"
                onPress={handleSearch}
                loading={searching}
              />
            </View>

            {searchResults.length === 0 &&
              searchQuery.length >= 2 &&
              !searching && (
                <Text style={styles.noResults}>No users found</Text>
              )}

            {searchResults.map((user) => (
              <Card key={user.id} style={styles.searchResult}>
                <View style={styles.searchResultInfo}>
                  <Text style={styles.searchResultName}>
                    {user.display_name || user.username}
                  </Text>
                  <Text style={styles.searchResultUsername}>
                    @{user.username}
                  </Text>
                </View>
                <Button
                  title="Add"
                  size="small"
                  onPress={() => handleSendRequest(user.id)}
                  loading={sendRequest.isPending}
                />
              </Card>
            ))}

            <Button
              title="Close"
              variant="outline"
              onPress={() => {
                setShowAddModal(false);
                setSearchQuery("");
                setSearchResults([]);
              }}
              style={styles.closeButton}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#000",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  requestCard: {
    marginBottom: 12,
  },
  requestInfo: {
    marginBottom: 12,
  },
  requestName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  requestUsername: {
    fontSize: 14,
    color: "#666",
  },
  requestActions: {
    flexDirection: "row",
    gap: 12,
  },
  acceptButton: {
    flex: 1,
  },
  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    padding: 12,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
  },
  friendUsername: {
    fontSize: 14,
    color: "#666",
  },
  removeButton: {
    borderColor: "#FF3B30",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginBottom: 0,
  },
  noResults: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
  },
  searchResult: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    padding: 12,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
  },
  searchResultUsername: {
    fontSize: 14,
    color: "#666",
  },
  closeButton: {
    marginTop: 16,
  },
});
