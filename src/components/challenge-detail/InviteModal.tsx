// src/components/challenge-detail/InviteModal.tsx
//
// CONTRACTS ENFORCED:
// - Owns its own search state (searchQuery, searchResults, searching)
//   No leaking into parent orchestrator
// - Filters out existingParticipantIds from results (fixes U2)
// - Filters out current user from results

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { XMarkIcon, MagnifyingGlassIcon } from "react-native-heroicons/outline";
import { useAppTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/auth";
import { Avatar } from "@/components/shared";
import { TestIDs } from "@/constants/testIDs";
import type { ProfilePublic } from "@/types/database";
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

  // Internal search state — not parent's concern
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfilePublic[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (searchQuery.length < 2) return;
    setSearching(true);
    try {
      const results = await authService.searchUsers(searchQuery);

      // Filter out current user AND existing participants (fixes U2)
      const excludeIds = new Set([
        ...(profile?.id ? [profile.id] : []),
        ...existingParticipantIds,
      ]);
      setSearchResults(results.filter((r) => !excludeIds.has(r.id)));
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearching(false);
    }
  }, [searchQuery, profile?.id, existingParticipantIds]);

  const handleInvite = useCallback(
    async (userId: string) => {
      setInvitingUserId(userId);
      try {
        await onInvite(userId);
        // Remove invited user from results
        setSearchResults((prev) => prev.filter((r) => r.id !== userId));
      } catch (err: any) {
        Alert.alert("Error", err.message || "Failed to invite user");
      } finally {
        setInvitingUserId(null);
      }
    },
    [onInvite],
  );

  const handleClose = useCallback(() => {
    // Reset internal state on close
    setSearchQuery("");
    setSearchResults([]);
    setSearching(false);
    setInvitingUserId(null);
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
              onSubmitEditing={handleSearch}
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
            onPress={handleSearch}
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
          {searching && (
            <View style={{ padding: spacing.md, alignItems: "center" }}>
              <Text style={{ color: colors.textMuted }}>Searching...</Text>
            </View>
          )}

          {!searching &&
            searchResults.length === 0 &&
            searchQuery.length >= 2 && (
              <View style={{ padding: spacing.md, alignItems: "center" }}>
                <Text style={{ color: colors.textMuted }}>No users found</Text>
              </View>
            )}

          {searchResults.map((user) => {
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
