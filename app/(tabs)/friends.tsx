// app/(tabs)/friends.tsx
// V2 Friends Screen - Friends list with search and requests
// Design System v2.0 - Based on prototype
//
// Features:
// - Search bar for finding users
// - Tab navigation (Friends, Requests)
// - Friend request accept/decline
// - Add friend functionality

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ScrollView,
  Alert,
  Keyboard,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/providers/ThemeProvider";
import {
  useFriends,
  usePendingFriendRequests,
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useSendFriendRequest,
} from "@/hooks/useFriends";
import { useUserSearch } from "@/hooks/useUserSearch";
import {
  LoadingState,
  EmptyState,
  FriendRow,
  FriendRequestRow,
  SearchResultRow,
} from "@/components/shared";
import { TestIDs } from "@/constants/testIDs";
import { MagnifyingGlassIcon, XMarkIcon } from "react-native-heroicons/outline";
import { extractErrorMessage } from "@/lib/extractErrorMessage";

type TabType = "friends" | "requests";

export default function FriendsScreenV2() {
  const { colors, spacing, radius } = useAppTheme();
  const [activeTab, setActiveTab] = useState<TabType>("friends");
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  const {
    data: friends,
    isLoading: loadingFriends,
    isError: friendsError,
    refetch: refetchFriends,
  } = useFriends();

  const {
    data: pendingRequests,
    isLoading: loadingRequests,
    isError: requestsError,
    refetch: refetchRequests,
  } = usePendingFriendRequests();

  const acceptRequest = useAcceptFriendRequest();
  const declineRequest = useDeclineFriendRequest();
  const sendRequest = useSendFriendRequest();
  const {
    data: searchData,
    isFetching: isSearching,
    error: searchError,
    debouncedQuery,
  } = useUserSearch(searchQuery);
  const friendsCount = friends?.length || 0;
  const requestsCount = pendingRequests?.length || 0;
  const trimmedSearchQuery = searchQuery.trim();
  const isSearchActive = trimmedSearchQuery.length > 0;
  const isWaitingForDebounce =
    trimmedSearchQuery.length >= 2 && debouncedQuery !== trimmedSearchQuery;
  const excludeIds = useMemo(() => {
    const ids = new Set(friends?.map((friend) => friend.friend_profile.id) ?? []);

    for (const request of pendingRequests ?? []) {
      ids.add(request.requester.id);
    }

    return ids;
  }, [friends, pendingRequests]);
  const filteredResults = useMemo(
    () => (searchData ?? []).filter((result) => !excludeIds.has(result.id)),
    [searchData, excludeIds],
  );

  // Auto-refresh on focus
  useFocusEffect(
    useCallback(() => {
      refetchFriends();
      refetchRequests();
    }, [refetchFriends, refetchRequests]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchFriends(), refetchRequests()]);
    setRefreshing(false);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  const handleSendRequest = async (userId: string) => {
    try {
      await sendRequest.mutateAsync(userId);
      setSentRequests((prev) => new Set(prev).add(userId));
      Alert.alert("Request Sent!", "Friend request has been sent");
    } catch (err: unknown) {
      Alert.alert("Error", extractErrorMessage(err));
    }
  };

  const handleAccept = async (friendshipId: string) => {
    try {
      await acceptRequest.mutateAsync(friendshipId);
    } catch (err: unknown) {
      Alert.alert("Error", extractErrorMessage(err));
    }
  };

  const handleDecline = async (friendshipId: string) => {
    try {
      await declineRequest.mutateAsync(friendshipId);
    } catch (err: unknown) {
      Alert.alert("Error", extractErrorMessage(err));
    }
  };

  // Loading state
  if (loadingFriends && loadingRequests) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <View style={[styles.headerContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Friends</Text>
        </View>
        <LoadingState variant="content" message="Loading friends..." />
      </SafeAreaView>
    );
  }

  // Error state
  if (friendsError || requestsError) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <View style={[styles.headerContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Friends</Text>
        </View>
        <EmptyState
          variant="generic"
          message="Failed to load friends"
          actionLabel="Retry"
          onAction={() => {
            refetchFriends();
            refetchRequests();
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
      testID={TestIDs.screensV2?.friends || "friends-screen-v2"}
    >
      {/* Header */}
      <View style={[styles.headerContainer, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Friends</Text>
      </View>

      {/* Search Bar */}
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
          },
        ]}
      >
        <View
          style={[
            styles.searchInputContainer,
            {
              backgroundColor: colors.background,
              borderRadius: radius.lg,
            },
          ]}
        >
          <MagnifyingGlassIcon size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search by username..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => Keyboard.dismiss()}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={handleClearSearch}
              accessibilityLabel="Clear search"
              accessibilityRole="button"
            >
              <XMarkIcon size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Results or Tabs */}
      {isSearchActive ? (
        // Search Results
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { padding: spacing.lg }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {trimmedSearchQuery.length < 2 ? (
            <EmptyState variant="search" compact message="Enter at least 2 characters to search" />
          ) : isWaitingForDebounce || isSearching ? (
            <LoadingState variant="inline" message="Searching..." />
          ) : searchError ? (
            <Text style={[styles.sectionTitle, { color: colors.error }]}>
              {extractErrorMessage(searchError)}
            </Text>
          ) : filteredResults.length === 0 ? (
            <EmptyState variant="search" compact message={`No users found for "${searchQuery}"`} />
          ) : (
            <View style={{ gap: spacing.sm }}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                SEARCH RESULTS ({filteredResults.length})
              </Text>
              {filteredResults.map((user) => (
                <SearchResultRow
                  key={user.id}
                  user={user}
                  onSendRequest={handleSendRequest}
                  loading={sendRequest.isPending}
                  alreadySent={sentRequests.has(user.id)}
                />
              ))}
            </View>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      ) : (
        <>
          {/* Tabs */}
          <View
            style={[
              styles.tabContainer,
              {
                backgroundColor: colors.surface,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === "friends" && {
                  borderBottomWidth: 2,
                  borderBottomColor: colors.primary.main,
                },
              ]}
              onPress={() => setActiveTab("friends")}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === "friends" }}
              accessibilityLabel={`Friends tab, ${friendsCount} friends`}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color: activeTab === "friends" ? colors.primary.main : colors.textMuted,
                  },
                ]}
              >
                Friends ({friendsCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === "requests" && {
                  borderBottomWidth: 2,
                  borderBottomColor: colors.primary.main,
                },
              ]}
              onPress={() => setActiveTab("requests")}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === "requests" }}
              accessibilityLabel={`Requests tab, ${requestsCount} requests`}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color: activeTab === "requests" ? colors.primary.main : colors.textMuted,
                  },
                ]}
              >
                Requests ({requestsCount})
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={[styles.scrollContent, { padding: spacing.lg }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary.main}
              />
            }
          >
            {/* Friends Tab */}
            {activeTab === "friends" && (
              <>
                {friendsCount === 0 ? (
                  <EmptyState
                    variant="friends"
                    message="Search for users above to add friends and start competing!"
                  />
                ) : (
                  <View style={{ gap: spacing.sm }}>
                    {friends?.map((friend) => (
                      <FriendRow key={friend.id} friend={friend} />
                    ))}
                  </View>
                )}
              </>
            )}

            {/* Requests Tab */}
            {activeTab === "requests" && (
              <>
                {requestsCount === 0 ? (
                  <EmptyState
                    variant="requests"
                    message="Friend requests from other users will appear here."
                  />
                ) : (
                  <View style={{ gap: spacing.sm }}>
                    {pendingRequests?.map((request) => (
                      <FriendRequestRow
                        key={request.id}
                        request={request}
                        onAccept={handleAccept}
                        onDecline={handleDecline}
                        loading={acceptRequest.isPending || declineRequest.isPending}
                      />
                    ))}
                  </View>
                )}
              </>
            )}

            {/* Bottom spacing for FAB */}
            <View style={{ height: 100 }} />
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  searchContainer: {},
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "PlusJakartaSans_500Medium",
    paddingVertical: 0,
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
  },
  tab: {
    paddingVertical: 12,
    marginRight: 24,
  },
  tabText: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  scrollContent: {
    flexGrow: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
});
