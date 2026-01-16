// app/challenge/[id].tsx
// Challenge detail screen - Design System v1.0
// Matches mockup: gradient header, progress card, styled leaderboard

import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Modal,
  Alert,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/hooks/useAuth";
import {
  useChallenge,
  useLeaderboard,
  useLogActivity,
  useInviteUser,
  useLeaveChallenge,
  useCancelChallenge,
} from "@/hooks/useChallenges";
import { useLeaderboardSubscription } from "@/hooks/useRealtimeSubscription";
import { authService } from "@/services/auth";
import {
  LoadingScreen,
  ErrorMessage,
  EmptyState,
  Avatar,
} from "@/components/ui";
import { useAppTheme } from "@/providers/ThemeProvider";
import {
  getEffectiveStatus,
  canLogActivity,
  getStatusLabel,
} from "@/lib/challengeStatus";
import { getServerNow } from "@/lib/serverTime";
import {
  ChevronLeftIcon,
  PlusIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
} from "react-native-heroicons/outline";
import type { ProfilePublic } from "@/types/database";

export default function ChallengeDetailScreen() {
  const { colors, spacing, radius, typography, shadows } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();

  const { data: challenge, isLoading, error, refetch } = useChallenge(id);
  const { data: leaderboard, refetch: refetchLeaderboard } = useLeaderboard(id);

  // Subscribe to realtime leaderboard updates for this challenge
  useLeaderboardSubscription(id);

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
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to log activity");
    }
  };

  const handleSearch = async () => {
    if (searchQuery.length < 2) return;
    setSearching(true);
    try {
      const results = await authService.searchUsers(searchQuery);
      setSearchResults(results.filter((r) => r.id !== profile?.id));
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearching(false);
    }
  };

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

  const handleLeaveChallenge = () => {
    if (!challenge) return;
    Alert.alert(
      "Leave Challenge",
      "Are you sure you want to leave? Your progress will be lost.",
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

  const handleCancelChallenge = () => {
    if (!challenge) return;
    Alert.alert(
      "Cancel Challenge",
      "This will end the challenge for all participants.",
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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ErrorMessage message="Failed to load challenge" onRetry={refetch} />
      </View>
    );
  }

  const isCreator = challenge.creator_id === profile?.id;
  const myInviteStatus = challenge.my_participation?.invite_status;
  const effectiveStatus = getEffectiveStatus(challenge, getServerNow());
  const challengeAllowsLogging = canLogActivity(challenge, getServerNow());
  const progress = challenge.my_participation?.current_progress || 0;
  const progressPercent = Math.min(
    (progress / challenge.goal_value) * 100,
    100
  );

  // Calculate days remaining using server time
  const endDate = new Date(challenge.end_date);
  const now = getServerNow();
  const daysLeft = Math.max(
    0,
    Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
          />
        }
      >
        {/* Gradient Header */}
        <LinearGradient
          colors={[colors.primary.main, colors.primary.dark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: spacing["2xl"],
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xl + 40, // Extra padding for overlap
          }}
        >
          {/* Back Button */}
          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: spacing.sm,
            }}
            onPress={() => router.back()}
          >
            <ChevronLeftIcon size={20} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>

          {/* Title */}
          <Text
            style={{
              fontSize: typography.fontSize.lg,
              fontFamily: "PlusJakartaSans_700Bold",
              color: "#FFFFFF",
            }}
          >
            {challenge.title}
          </Text>

          {/* Meta Info */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              marginTop: spacing.xs,
            }}
          >
            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.2)",
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                borderRadius: radius.tag,
              }}
            >
              <Text
                style={{
                  fontSize: typography.fontSize.xs,
                  fontFamily: "PlusJakartaSans_500Medium",
                  color: "#FFFFFF",
                }}
              >
                {daysLeft} days left
              </Text>
            </View>
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontFamily: "PlusJakartaSans_500Medium",
                color: "rgba(255,255,255,0.8)",
              }}
            >
              • {leaderboard?.length || 0} participants
            </Text>
          </View>
        </LinearGradient>

        {/* Progress Card (overlapping header) */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: -40 }}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.card,
              padding: spacing.lg,
              alignItems: "center",
              ...shadows.elevated,
            }}
          >
            <Text
              style={{
                fontSize: typography.fontSize.xs,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.textSecondary,
              }}
            >
              Your Progress
            </Text>
            <Text
              style={{
                fontSize: 32,
                fontFamily: "PlusJakartaSans_700Bold",
                color: colors.primary.main,
                marginVertical: spacing.xs,
              }}
            >
              {progress.toLocaleString()}
            </Text>
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.textMuted,
              }}
            >
              of {challenge.goal_value.toLocaleString()} {challenge.goal_unit}
            </Text>

            {/* Progress Bar */}
            <View
              style={{
                width: "100%",
                height: 8,
                backgroundColor: colors.primary.subtle,
                borderRadius: 4,
                marginTop: spacing.md,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${progressPercent}%`,
                  height: "100%",
                  backgroundColor: colors.primary.main,
                  borderRadius: 4,
                }}
              />
            </View>
          </View>
        </View>

        {/* Leaderboard */}
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}>
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
            Leaderboard
          </Text>

          {leaderboard && leaderboard.length > 0 ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.card,
                overflow: "hidden",
                ...shadows.card,
              }}
            >
              {leaderboard.map((entry, index) => {
                const isMe = entry.user_id === profile?.id;
                return (
                  <View
                    key={entry.user_id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: spacing.md,
                      gap: spacing.sm,
                      borderBottomWidth: index < leaderboard.length - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                      backgroundColor: isMe
                        ? colors.primary.subtle
                        : "transparent",
                    }}
                  >
                    {/* Rank Badge */}
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: radius.badge,
                        backgroundColor:
                          index < 3
                            ? colors.achievement.main
                            : colors.textMuted,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: typography.fontSize.xs,
                          fontFamily: "PlusJakartaSans_700Bold",
                          color: "#FFFFFF",
                        }}
                      >
                        {index + 1}
                      </Text>
                    </View>

                    {/* Avatar */}
                    <Avatar
                      name={
                        entry.profile.display_name || entry.profile.username
                      }
                      size="sm"
                    />

                    {/* Name */}
                    <Text
                      style={{
                        flex: 1,
                        fontSize: typography.fontSize.base,
                        fontFamily: "PlusJakartaSans_500Medium",
                        color: isMe ? colors.primary.dark : colors.textPrimary,
                      }}
                    >
                      {isMe
                        ? "You"
                        : entry.profile.display_name || entry.profile.username}
                    </Text>

                    {/* Score */}
                    <Text
                      style={{
                        fontSize: typography.fontSize.base,
                        fontFamily: "PlusJakartaSans_600SemiBold",
                        color: isMe
                          ? colors.primary.main
                          : colors.textSecondary,
                      }}
                    >
                      {entry.current_progress.toLocaleString()}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : myInviteStatus === "pending" ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.card,
                padding: spacing.xl,
                alignItems: "center",
                ...shadows.card,
              }}
            >
              <Text
                style={{
                  fontSize: typography.fontSize.base,
                  fontFamily: "PlusJakartaSans_500Medium",
                  color: colors.textMuted,
                }}
              >
                🔒 Accept the challenge to view leaderboard
              </Text>
            </View>
          ) : (
            <EmptyState
              title="No participants yet"
              message="Invite friends to compete!"
            />
          )}
        </View>

        {/* Log Activity Button */}
        {challengeAllowsLogging && myInviteStatus === "accepted" && (
          <View
            style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}
          >
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: spacing.sm,
                backgroundColor: colors.primary.main,
                borderRadius: radius.button,
                paddingVertical: spacing.md,
              }}
              onPress={() => setShowLogModal(true)}
            >
              <PlusIcon size={18} color="#FFFFFF" />
              <Text
                style={{
                  fontSize: typography.fontSize.base,
                  fontFamily: "PlusJakartaSans_600SemiBold",
                  color: "#FFFFFF",
                }}
              >
                Log Activity
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Creator Actions */}
        {isCreator && effectiveStatus === "upcoming" && (
          <View
            style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}
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
              onPress={() => setShowInviteModal(true)}
            >
              <Text
                style={{
                  fontSize: typography.fontSize.base,
                  fontFamily: "PlusJakartaSans_600SemiBold",
                  color: colors.primary.main,
                }}
              >
                + Invite Friends
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Leave/Cancel - Hidden for completed challenges */}
        {myInviteStatus === "accepted" && effectiveStatus !== "completed" && (
          <View
            style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}
          >
            <TouchableOpacity
              style={{
                backgroundColor: "transparent",
                borderWidth: 1,
                borderColor: colors.error,
                borderRadius: radius.button,
                paddingVertical: spacing.md,
              }}
              onPress={isCreator ? handleCancelChallenge : handleLeaveChallenge}
            >
              <Text
                style={{
                  fontSize: typography.fontSize.base,
                  fontFamily: "PlusJakartaSans_600SemiBold",
                  color: colors.error,
                  textAlign: "center",
                }}
              >
                {isCreator ? "Cancel Challenge" : "Leave Challenge"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Log Activity Modal */}
      <Modal
        visible={showLogModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowLogModal(false)}
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
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
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
                Log Activity
              </Text>
              <TouchableOpacity onPress={() => setShowLogModal(false)}>
                <XMarkIcon size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.textSecondary,
                marginBottom: spacing.xs,
              }}
            >
              {challenge.challenge_type === "custom" &&
              challenge.custom_activity_name
                ? challenge.custom_activity_name
                : challenge.challenge_type.replace("_", " ")}{" "}
              ({challenge.goal_unit})
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.background,
                borderRadius: radius.input,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
                fontSize: typography.fontSize.base,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.textPrimary,
                marginBottom: spacing.lg,
              }}
              value={activityValue}
              onChangeText={setActivityValue}
              placeholder={challenge.challenge_type === "steps" ? "5000" : "30"}
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              autoFocus
            />

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: "transparent",
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.button,
                  paddingVertical: spacing.md,
                }}
                onPress={() => {
                  setShowLogModal(false);
                  setActivityValue("");
                }}
              >
                <Text
                  style={{
                    fontSize: typography.fontSize.base,
                    fontFamily: "PlusJakartaSans_600SemiBold",
                    color: colors.textSecondary,
                    textAlign: "center",
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: colors.primary.main,
                  borderRadius: radius.button,
                  paddingVertical: spacing.md,
                  opacity: logActivity.isPending ? 0.7 : 1,
                }}
                onPress={handleLogActivity}
                disabled={logActivity.isPending}
              >
                <Text
                  style={{
                    fontSize: typography.fontSize.base,
                    fontFamily: "PlusJakartaSans_600SemiBold",
                    color: "#FFFFFF",
                    textAlign: "center",
                  }}
                >
                  {logActivity.isPending ? "Logging..." : "Log"}
                </Text>
              </TouchableOpacity>
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
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
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
                Invite Friends
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowInviteModal(false);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
              >
                <XMarkIcon size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

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
                    onPress={() => handleInvite(user.id)}
                  >
                    <Text
                      style={{
                        fontSize: typography.fontSize.sm,
                        fontFamily: "PlusJakartaSans_600SemiBold",
                        color: "#FFFFFF",
                      }}
                    >
                      Invite
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
