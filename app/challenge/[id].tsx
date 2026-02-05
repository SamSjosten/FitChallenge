// app/challenge/[id].tsx
// Challenge detail screen router
// Conditionally renders V1 or V2 based on feature flag

import React, { useState, useEffect } from "react";
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
import { useFeatureFlags } from "@/lib/featureFlags";
import {
  useChallenge,
  useLeaderboard,
  useLogActivity,
  useInviteUser,
  useLeaveChallenge,
  useCancelChallenge,
} from "@/hooks/useChallenges";
import { generateClientEventId } from "@/services/activities";
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
import { getServerNow, syncServerTime } from "@/lib/serverTime";
import { TestIDs } from "@/constants/testIDs";
import {
  ChevronLeftIcon,
  PlusIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
} from "react-native-heroicons/outline";
import type { ProfilePublic } from "@/types/database";

// V2 Import
import { ChallengeDetailScreenV2 } from "@/components/challenge-detail-v2";

// =============================================================================
// ROUTER COMPONENT
// =============================================================================

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { uiVersion, isLoading: flagsLoading } = useFeatureFlags();

  // Show loading while flags are loading
  if (flagsLoading) {
    return <LoadingScreen />;
  }

  // Route to V2 if enabled
  if (uiVersion === "v2" && id) {
    return <ChallengeDetailScreenV2 challengeId={id} />;
  }

  // Otherwise render V1
  return <ChallengeDetailScreenV1 />;
}

// =============================================================================
// V1 IMPLEMENTATION (Original)
// =============================================================================

function ChallengeDetailScreenV1() {
  const { colors, spacing, radius, typography, shadows } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { uiVersion } = useFeatureFlags();

  const { data: challenge, isLoading, error, refetch } = useChallenge(id);
  const { data: leaderboard, refetch: refetchLeaderboard } = useLeaderboard(id);

  // Fallback route for back button when no history
  const homeFallback = uiVersion === "v2" ? "/(tabs-v2)" : "/(tabs)";

  // Subscribe to realtime leaderboard updates for this challenge
  useLeaderboardSubscription(id);

  // Ensure server time is synced for accurate status display
  // Non-blocking: respects needsResync() gate, no-op if fresh
  useEffect(() => {
    syncServerTime().catch(() => {
      // Silently handled - banner will show if sync consistently fails
    });
  }, [id]);

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

    // Generate idempotency key ONCE before calling mutate.
    // React Query retries will reuse this same ID, preventing double-counting.
    const client_event_id = generateClientEventId();

    try {
      await logActivity.mutateAsync({
        challenge_id: challenge.id,
        activity_type: challenge.challenge_type,
        value: parseInt(activityValue),
        client_event_id,
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
      ],
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
      ],
    );
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!id) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ErrorMessage
          message="No challenge ID provided"
          onRetry={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace(homeFallback);
            }
          }}
        />
      </View>
    );
  }

  if (error || !challenge) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ErrorMessage
          message="Failed to load challenge"
          onRetry={() => refetch()}
        />
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace(homeFallback);
            }
          }}
          style={{ marginTop: 16, padding: 12 }}
        >
          <Text style={{ color: colors.primary.main }}>Go Back</Text>
        </TouchableOpacity>
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
    100,
  );

  return (
    <View
      testID={TestIDs.screens.challengeDetail}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Gradient Header */}
        <LinearGradient
          colors={[colors.primary.main, colors.primary.dark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: 60, paddingBottom: spacing.xl }}
        >
          {/* Back Button */}
          <TouchableOpacity
            testID={TestIDs.nav.backButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace(homeFallback);
              }
            }}
            style={{
              position: "absolute",
              top: 48,
              left: spacing.md,
              zIndex: 10,
              padding: spacing.sm,
            }}
          >
            <ChevronLeftIcon size={28} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Header Content */}
          <View style={{ paddingHorizontal: spacing.lg }}>
            <Text
              testID={TestIDs.challengeDetail.challengeTitle}
              style={{
                fontSize: typography.fontSize["2xl"],
                fontFamily: "PlusJakartaSans_700Bold",
                color: "#FFFFFF",
                marginTop: spacing.lg,
                marginBottom: spacing.xs,
              }}
            >
              {challenge.title}
            </Text>

            {/* Status Badge */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <View
                testID={TestIDs.challengeDetail.challengeStatus}
                style={{
                  backgroundColor: "rgba(255,255,255,0.2)",
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xs,
                  borderRadius: radius.badge,
                }}
              >
                <Text
                  style={{
                    fontSize: typography.fontSize.xs,
                    fontFamily: "PlusJakartaSans_600SemiBold",
                    color: "#FFFFFF",
                    textTransform: "uppercase",
                  }}
                >
                  {getStatusLabel(effectiveStatus)}
                </Text>
              </View>
              {effectiveStatus === "active" && (
                <Text
                  testID={TestIDs.challengeDetail.daysRemaining}
                  style={{
                    fontSize: typography.fontSize.sm,
                    fontFamily: "PlusJakartaSans_500Medium",
                    color: "rgba(255,255,255,0.9)",
                  }}
                >
                  {Math.ceil(
                    (new Date(challenge.end_date).getTime() - Date.now()) /
                      (1000 * 60 * 60 * 24),
                  )}{" "}
                  days left
                </Text>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* Progress Card */}
        <View
          testID={TestIDs.challengeDetail.progressCard}
          style={{
            marginHorizontal: spacing.lg,
            marginTop: -spacing.xl,
            backgroundColor: colors.surface,
            borderRadius: radius.card,
            padding: spacing.lg,
            ...shadows.card,
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
            Your Progress
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              marginBottom: spacing.xs,
            }}
          >
            <Text
              testID={TestIDs.challengeDetail.progressText}
              style={{
                fontSize: typography.fontSize["3xl"],
                fontFamily: "PlusJakartaSans_700Bold",
                color: colors.primary.main,
              }}
            >
              {progress.toLocaleString()}
            </Text>
            <Text
              style={{
                fontSize: typography.fontSize.lg,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.textMuted,
                marginLeft: spacing.xs,
              }}
            >
              / {challenge.goal_value.toLocaleString()} {challenge.goal_unit}
            </Text>
          </View>

          {/* Progress Bar */}
          <View
            testID={TestIDs.challengeDetail.progressBar}
            style={{
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
              testID={TestIDs.challengeDetail.leaderboardSection}
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.card,
                overflow: "hidden",
                ...shadows.card,
              }}
            >
              {leaderboard.map((entry, index) => {
                const isMe = entry.user_id === profile?.id;
                const username = entry.profile.username;
                return (
                  <View
                    key={entry.user_id}
                    testID={
                      isMe
                        ? TestIDs.challengeDetail.leaderboardEntryHighlighted(
                            username,
                          )
                        : TestIDs.challengeDetail.leaderboardEntry(index)
                    }
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
              testID={TestIDs.challengeDetail.leaderboardLocked}
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

        {/* Action Buttons */}
        <View
          style={{
            padding: spacing.lg,
            gap: spacing.md,
          }}
        >
          {/* Log Activity Button - only show if challenge is active and user is accepted */}
          {myInviteStatus === "accepted" && challengeAllowsLogging && (
            <TouchableOpacity
              testID={TestIDs.challengeDetail.logActivityButton}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: spacing.sm,
                backgroundColor: colors.primary.main,
                paddingVertical: spacing.md,
                borderRadius: radius.button,
                ...shadows.button,
              }}
              onPress={() => setShowLogModal(true)}
            >
              <PlusIcon size={20} color="#FFFFFF" />
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
          )}

          {/* Invite Button - only show if creator */}
          {isCreator && (
            <TouchableOpacity
              testID={TestIDs.challengeDetail.inviteButton}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: spacing.sm,
                backgroundColor: "transparent",
                paddingVertical: spacing.md,
                borderRadius: radius.button,
                borderWidth: 1,
                borderColor: colors.primary.main,
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
                Invite Friends
              </Text>
            </TouchableOpacity>
          )}

          {/* Leave/Cancel Button */}
          {isCreator ? (
            <TouchableOpacity
              testID={TestIDs.challengeDetail.cancelChallengeButton}
              style={{
                alignItems: "center",
                paddingVertical: spacing.sm,
              }}
              onPress={handleCancelChallenge}
            >
              <Text
                style={{
                  fontSize: typography.fontSize.sm,
                  fontFamily: "PlusJakartaSans_500Medium",
                  color: colors.error,
                }}
              >
                Cancel Challenge
              </Text>
            </TouchableOpacity>
          ) : myInviteStatus === "accepted" ? (
            <TouchableOpacity
              testID={TestIDs.challengeDetail.leaveButton}
              style={{
                alignItems: "center",
                paddingVertical: spacing.sm,
              }}
              onPress={handleLeaveChallenge}
            >
              <Text
                style={{
                  fontSize: typography.fontSize.sm,
                  fontFamily: "PlusJakartaSans_500Medium",
                  color: colors.error,
                }}
              >
                Leave Challenge
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
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
            testID={TestIDs.logActivity.modal}
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.modal,
              padding: spacing.xl,
            }}
          >
            <Text
              style={{
                fontSize: typography.fontSize.xl,
                fontFamily: "PlusJakartaSans_700Bold",
                color: colors.textPrimary,
                marginBottom: spacing.lg,
              }}
            >
              Log Activity
            </Text>

            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.textSecondary,
                marginBottom: spacing.xs,
              }}
            >
              Enter {challenge.goal_unit}
            </Text>

            <TextInput
              testID={TestIDs.logActivity.valueInput}
              style={{
                backgroundColor: colors.background,
                borderRadius: radius.input,
                padding: spacing.md,
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
                testID={TestIDs.logActivity.cancelButton}
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
                testID={TestIDs.logActivity.submitButton}
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
            testID={TestIDs.invite.modal}
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
                testID={TestIDs.invite.closeButton}
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
                  testID={TestIDs.invite.searchInput}
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
                testID={TestIDs.invite.searchButton}
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
                  testID={TestIDs.invite.userResult(user.id)}
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
                    testID={TestIDs.invite.sendInviteButton(user.id)}
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
