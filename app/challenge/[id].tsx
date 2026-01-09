// app/challenge/[id].tsx
// Challenge detail screen with leaderboard and activity logging

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
import { useLocalSearchParams, router } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import {
  useChallenge,
  useLeaderboard,
  useLogActivity,
  useInviteUser,
  useLeaveChallenge,
  useCancelChallenge,
} from "@/hooks/useChallenges";
import { authService } from "@/services/auth";
import {
  Button,
  Card,
  Input,
  LoadingScreen,
  ErrorMessage,
  EmptyState,
} from "@/components/ui";
import {
  getEffectiveStatus,
  canLogActivity,
  getStatusLabel,
  getStatusColor,
} from "@/lib/challengeStatus";
import type { ProfilePublic } from "@/types/database";

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();

  const { data: challenge, isLoading, error, refetch } = useChallenge(id);
  // Always fetch leaderboard - RLS handles visibility (Rule 2, 6)
  // Pending users will get empty results due to RLS policy
  const { data: leaderboard, refetch: refetchLeaderboard } = useLeaderboard(id);
  const logActivity = useLogActivity();
  const inviteUser = useInviteUser();
  const leaveChallenge = useLeaveChallenge();
  const cancelChallenge = useCancelChallenge();

  const [refreshing, setRefreshing] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activityValue, setActivityValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfilePublic[]>([]);
  const [searching, setSearching] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchLeaderboard()]);
    setRefreshing(false);
  };

  // Handle activity logging
  const handleLogActivity = async () => {
    if (!activityValue || parseInt(activityValue) <= 0) {
      Alert.alert("Invalid Value", "Please enter a positive number");
      return;
    }

    if (!challenge) return;

    try {
      await logActivity.mutateAsync({
        challenge_id: challenge.id,
        activity_type: challenge.challenge_type,
        value: parseInt(activityValue),
      });
      setShowLogModal(false);
      setActivityValue("");
      Alert.alert("Activity Logged! 🎉", "Your progress has been updated");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to log activity");
    }
  };

  // Handle user search for invite
  const handleSearch = async () => {
    if (searchQuery.length < 2) return;
    setSearching(true);
    try {
      const results = await authService.searchUsers(searchQuery);
      // Filter out self
      setSearchResults(results.filter((r) => r.id !== profile?.id));
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearching(false);
    }
  };

  // Handle invite
  const handleInvite = async (userId: string) => {
    if (!challenge) return;
    try {
      await inviteUser.mutateAsync({
        challenge_id: challenge.id,
        user_id: userId,
      });
      Alert.alert("Invited!", "User has been invited to the challenge");
      setShowInviteModal(false);
      setSearchQuery("");
      setSearchResults([]);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to invite user");
    }
  };

  // Handle leaving a challenge
  const handleLeaveChallenge = () => {
    if (!challenge) return;

    Alert.alert(
      "Leave Challenge",
      "Are you sure you want to leave this challenge? Your progress will be lost.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            try {
              await leaveChallenge.mutateAsync(challenge.id);
              router.back();
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to leave challenge");
            }
          },
        },
      ]
    );
  };

  // Handle cancelling a challenge (creator only)
  const handleCancelChallenge = () => {
    if (!challenge) return;

    Alert.alert(
      "Cancel Challenge",
      "Are you sure you want to cancel this challenge? This will end the challenge for all participants.",
      [
        { text: "Keep Challenge", style: "cancel" },
        {
          text: "Cancel Challenge",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelChallenge.mutateAsync(challenge.id);
              router.back();
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to cancel challenge");
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error || !challenge) {
    return (
      <View style={styles.errorContainer}>
        <ErrorMessage message="Failed to load challenge" onRetry={refetch} />
      </View>
    );
  }

  // CONTRACT: Authorization is RLS-enforced, not UI-enforced (Rule 2)
  // UI may reflect database states but not gate on them
  const isCreator = challenge.creator_id === profile?.id;
  const myInviteStatus = challenge.my_participation?.invite_status;

  // Derive status from time bounds (matches DB function)
  const effectiveStatus = getEffectiveStatus(challenge);

  // Leaderboard visibility is determined by RLS - empty results = not authorized
  // Log activity: RPC will reject if not accepted participant
  // Use time-derived status, not stored status column
  const challengeAllowsLogging = canLogActivity(challenge);

  // Find current user's rank in leaderboard (if visible per RLS)
  const myRank = leaderboard?.findIndex((e) => e.user_id === profile?.id);
  const myEntry =
    myRank !== undefined && myRank >= 0 ? leaderboard?.[myRank] : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Challenge Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{challenge.title}</Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(effectiveStatus) },
          ]}
        >
          <Text style={styles.statusText}>
            {getStatusLabel(effectiveStatus)}
          </Text>
        </View>
      </View>

      {challenge.description && (
        <Text style={styles.description}>{challenge.description}</Text>
      )}

      {/* Challenge Info */}
      <Card style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Type</Text>
          <Text style={styles.infoValue}>
            {challenge.challenge_type.replace("_", " ")}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Goal</Text>
          <Text style={styles.infoValue}>
            {challenge.goal_value} {challenge.goal_unit}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Win Condition</Text>
          <Text style={styles.infoValue}>
            {challenge.win_condition.replace("_", " ")}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Starts</Text>
          <Text style={styles.infoValue}>
            {new Date(challenge.start_date).toLocaleString()}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Ends</Text>
          <Text style={styles.infoValue}>
            {new Date(challenge.end_date).toLocaleString()}
          </Text>
        </View>
      </Card>

      {/* My Progress - shown for all participants (pending or accepted) */}
      {/* RLS ensures we only see our own participation row */}
      {challenge.my_participation && (
        <Card style={styles.progressCard}>
          <Text style={styles.cardTitle}>My Progress</Text>
          {myInviteStatus === "pending" && (
            <Text style={styles.pendingNote}>
              Accept the challenge to start competing
            </Text>
          )}
          <View style={styles.progressRow}>
            <View style={styles.progressStat}>
              <Text style={styles.progressValue}>
                {challenge.my_participation?.current_progress || 0}
              </Text>
              <Text style={styles.progressLabel}>
                / {challenge.goal_value} {challenge.goal_unit}
              </Text>
            </View>
            {myEntry && (
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>#{myEntry.rank}</Text>
              </View>
            )}
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(
                    ((challenge.my_participation?.current_progress || 0) /
                      challenge.goal_value) *
                      100,
                    100
                  )}%`,
                },
              ]}
            />
          </View>
          {/* Show log button if challenge allows logging; RPC enforces participation check */}
          {challengeAllowsLogging && (
            <Button
              title="Log Activity"
              onPress={() => setShowLogModal(true)}
              style={styles.logButton}
            />
          )}
        </Card>
      )}

      {/* Leaderboard */}
      {/* RLS handles visibility - pending users get empty results */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Leaderboard</Text>
          {isCreator && effectiveStatus === "upcoming" && (
            <Button
              title="+ Invite"
              variant="outline"
              size="small"
              onPress={() => setShowInviteModal(true)}
            />
          )}
          {isCreator && effectiveStatus !== "upcoming" && (
            <Text style={styles.inviteDisabledNote}>Invites closed</Text>
          )}
        </View>

        {/* Reflect RLS state: empty results for pending users */}
        {leaderboard && leaderboard.length > 0 ? (
          leaderboard.map((entry, index) => (
            <Card
              key={entry.user_id}
              style={[
                styles.leaderboardEntry,
                entry.user_id === profile?.id && styles.myEntry,
              ]}
            >
              <View style={styles.leaderboardRank}>
                <Text style={styles.rankNumber}>
                  {index === 0
                    ? "🥇"
                    : index === 1
                    ? "🥈"
                    : index === 2
                    ? "🥉"
                    : `#${entry.rank}`}
                </Text>
              </View>
              <View style={styles.leaderboardInfo}>
                <Text style={styles.leaderboardName}>
                  {entry.profile.display_name || entry.profile.username}
                  {entry.user_id === profile?.id && " (You)"}
                </Text>
                <Text style={styles.leaderboardProgress}>
                  {entry.current_progress} {challenge.goal_unit}
                </Text>
              </View>
            </Card>
          ))
        ) : myInviteStatus === "pending" ? (
          // Empty due to RLS blocking pending users
          <Card style={styles.lockedCard}>
            <Text style={styles.lockedText}>
              🔒 Accept the challenge to view the leaderboard
            </Text>
          </Card>
        ) : (
          // Genuinely empty - no other accepted participants
          <EmptyState
            title="No participants yet"
            message="Invite friends to compete!"
          />
        )}
      </View>

      {/* Leave/Cancel Challenge */}
      {myInviteStatus === "accepted" && (
        <View style={styles.dangerSection}>
          {isCreator ? (
            <Button
              title="Cancel Challenge"
              variant="outline"
              onPress={handleCancelChallenge}
              loading={cancelChallenge.isPending}
              style={styles.leaveButton}
            />
          ) : (
            <Button
              title="Leave Challenge"
              variant="outline"
              onPress={handleLeaveChallenge}
              loading={leaveChallenge.isPending}
              style={styles.leaveButton}
            />
          )}
        </View>
      )}

      {/* Log Activity Modal */}
      <Modal
        visible={showLogModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowLogModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Log Activity</Text>
            <Input
              label={`${challenge.challenge_type.replace("_", " ")} (${
                challenge.goal_unit
              })`}
              value={activityValue}
              onChangeText={setActivityValue}
              placeholder={`e.g., ${
                challenge.challenge_type === "steps" ? "5000" : "30"
              }`}
              keyboardType="number-pad"
            />
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => {
                  setShowLogModal(false);
                  setActivityValue("");
                }}
                style={styles.modalButton}
              />
              <Button
                title="Log"
                onPress={handleLogActivity}
                loading={logActivity.isPending}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Invite Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Invite Friend</Text>
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
                  title="Invite"
                  size="small"
                  onPress={() => handleInvite(user.id)}
                  loading={inviteUser.isPending}
                />
              </Card>
            ))}
            <Button
              title="Close"
              variant="outline"
              onPress={() => {
                setShowInviteModal(false);
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
    paddingBottom: 32,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 12,
  },
  statusActive: {
    backgroundColor: "#34C759",
  },
  statusPending: {
    backgroundColor: "#FF9500",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  description: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  infoCard: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  infoLabel: {
    fontSize: 14,
    color: "#666",
  },
  infoValue: {
    fontSize: 14,
    color: "#000",
    fontWeight: "500",
    textTransform: "capitalize",
  },
  progressCard: {
    marginBottom: 16,
    backgroundColor: "#F0F8FF",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  progressStat: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  progressValue: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#007AFF",
  },
  progressLabel: {
    fontSize: 14,
    color: "#666",
    marginLeft: 4,
  },
  rankBadge: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  rankText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  progressBar: {
    height: 12,
    backgroundColor: "#E5E5EA",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 16,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#007AFF",
    borderRadius: 6,
  },
  logButton: {
    marginTop: 8,
  },
  pendingNote: {
    fontSize: 14,
    color: "#FF9500",
    fontStyle: "italic",
    marginBottom: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  lockedCard: {
    alignItems: "center",
    padding: 24,
  },
  lockedText: {
    fontSize: 14,
    color: "#666",
  },
  leaderboardEntry: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    padding: 12,
  },
  myEntry: {
    backgroundColor: "#F0F8FF",
    borderWidth: 1,
    borderColor: "#007AFF",
  },
  leaderboardRank: {
    width: 40,
    alignItems: "center",
  },
  rankNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  leaderboardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  leaderboardName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
  },
  leaderboardProgress: {
    fontSize: 14,
    color: "#666",
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
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
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
  dangerSection: {
    marginTop: 24,
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
  },
  leaveButton: {
    borderColor: "#FF3B30",
  },
  inviteDisabledNote: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
  },
});
