// src/components/challenge-detail/InviteModal.tsx
//
// CONTRACTS ENFORCED:
// - Owns its own search state (searchQuery, searchResults, searching)
//   No leaking into parent orchestrator
// - Filters out existingParticipantIds from results (fixes U2)
// - Filters out current user from results

import React, { useState, useCallback, useMemo } from "react";
import { extractErrorMessage } from "@/lib/extractErrorMessage";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  Keyboard,
} from "react-native";
import { XMarkIcon, MagnifyingGlassIcon } from "react-native-heroicons/outline";
import { useAppTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import { useUserSearch } from "@/hooks/useUserSearch";
import { Avatar } from "@/components/shared";
import { TestIDs } from "@/constants/testIDs";
import type { InviteModalProps } from "./types";

export function InviteModal({
  visible,
  onClose,
  challengeId: _challengeId,
  existingParticipantIds,
  onInvite,
}: InviteModalProps) {
  const { colors, spacing, radius, typography } = useAppTheme();
  const { profile } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const {
    data: searchData,
    isFetching: isSearching,
    error: searchError,
    debouncedQuery,
  } = useUserSearch(searchQuery);
  const trimmedSearchQuery = searchQuery.trim();
  const isWaitingForDebounce =
    trimmedSearchQuery.length >= 2 && debouncedQuery !== trimmedSearchQuery;
  const excludeIds = useMemo(() => {
    const ids = new Set(existingParticipantIds);
    if (profile?.id) ids.add(profile.id);

    for (const invitedId of invitedIds) {
      ids.add(invitedId);
    }

    return ids;
  }, [existingParticipantIds, invitedIds, profile?.id]);
  const filteredResults = useMemo(
    () => (searchData ?? []).filter((result) => !excludeIds.has(result.id)),
    [searchData, excludeIds],
  );

  const handleInvite = useCallback(
    async (userId: string) => {
      setInvitingUserId(userId);
      try {
        await onInvite(userId);
        setInvitedIds((prev) => new Set(prev).add(userId));
      } catch (err: unknown) {
        Alert.alert("Error", extractErrorMessage(err));
      } finally {
        setInvitingUserId(null);
      }
    },
    [onInvite],
  );

  const handleClose = useCallback(() => {
    setSearchQuery("");
    setInvitingUserId(null);
    setInvitedIds(new Set());
    onClose();
  }, [onClose]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <TouchableOpacity
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.4)",
        }}
        activeOpacity={1}
        onPress={handleClose}
      />

      <View
        style={{
          position: "absolute",
          top: "15%",
          left: spacing.xl,
          right: spacing.xl,
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.lg,
          maxHeight: "70%",
        }}
        testID={TestIDs.invite.modal}
      >
        {/* Header */}
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
            onPress={handleClose}
            testID={TestIDs.invite.closeButton}
            accessibilityLabel="Close invite modal"
          >
            <XMarkIcon size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Search */}
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
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
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
              onSubmitEditing={() => Keyboard.dismiss()}
              returnKeyType="search"
              accessibilityLabel="Search for users to invite"
            />
          </View>
          <TouchableOpacity
            testID={TestIDs.invite.searchButton}
            style={{
              backgroundColor: colors.primary.main,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.md,
              justifyContent: "center",
            }}
            onPress={() => Keyboard.dismiss()}
            accessibilityLabel="Search"
            accessibilityRole="button"
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

        {/* Results */}
        <ScrollView style={{ maxHeight: 300 }}>
          {trimmedSearchQuery.length > 0 && trimmedSearchQuery.length < 2 && (
            <View style={{ padding: spacing.md, alignItems: "center" }}>
              <Text style={{ color: colors.textMuted }}>Enter at least 2 characters</Text>
            </View>
          )}

          {(isWaitingForDebounce || isSearching) && trimmedSearchQuery.length >= 2 && (
            <View style={{ padding: spacing.md, alignItems: "center" }}>
              <Text style={{ color: colors.textMuted }}>Searching...</Text>
            </View>
          )}

          {!isWaitingForDebounce &&
            !isSearching &&
            searchError &&
            trimmedSearchQuery.length >= 2 && (
              <View style={{ padding: spacing.md, alignItems: "center" }}>
                <Text style={{ color: colors.error }}>{extractErrorMessage(searchError)}</Text>
              </View>
            )}

          {!isWaitingForDebounce &&
            !isSearching &&
            !searchError &&
            filteredResults.length === 0 &&
            trimmedSearchQuery.length >= 2 && (
              <View style={{ padding: spacing.md, alignItems: "center" }}>
                <Text style={{ color: colors.textMuted }}>No users found</Text>
              </View>
            )}

          {filteredResults.map((user) => {
            const isInviting = invitingUserId === user.id;
            return (
              <View
                key={user.id}
                testID={TestIDs.invite.userResult(user.id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: spacing.md,
                  backgroundColor: colors.background,
                  borderRadius: radius.md,
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
                    borderRadius: radius.md,
                    opacity: isInviting ? 0.6 : 1,
                  }}
                  onPress={() => handleInvite(user.id)}
                  disabled={isInviting}
                  accessibilityLabel={`Invite ${user.display_name || user.username}`}
                  accessibilityRole="button"
                >
                  <Text
                    style={{
                      fontSize: typography.fontSize.sm,
                      fontFamily: "PlusJakartaSans_600SemiBold",
                      color: "#FFFFFF",
                    }}
                  >
                    {isInviting ? "..." : "Invite"}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}
