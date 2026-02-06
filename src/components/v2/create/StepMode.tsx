// src/components/v2/create/StepMode.tsx
// Step 0: Choose between Social challenge and Solo goal

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import {
  UserGroupIcon,
  ChevronRightIcon,
} from "react-native-heroicons/outline";
import type { StepModeProps, ChallengeMode } from "./types";

// Using a target-like icon for solo; UserGroup for social
// Heroicons doesn't have a perfect "target" so we use the custom ActivityIcon
const TARGET_ICON_COLOR = { text: "#3B82F6", bg: "#DBEAFE" }; // Blue
const SOCIAL_ICON_COLOR = { text: "#10B981", bg: "#D1FAE5" }; // Emerald

interface ModeCardProps {
  mode: ChallengeMode;
  title: string;
  description: string;
  tags: string[];
  tagColor: { bg: string; text: string };
  iconBg: string;
  iconColor: string;
  onPress: () => void;
}

function ModeCard({
  title,
  description,
  tags,
  tagColor,
  iconBg,
  iconColor,
  onPress,
  mode,
}: ModeCardProps) {
  const { colors, radius, spacing } = useAppTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderRadius: radius["2xl"],
        },
      ]}
    >
      <View style={styles.cardContent}>
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: iconBg, borderRadius: radius.xl },
          ]}
        >
          {mode === "social" ? (
            <UserGroupIcon size={24} color={iconColor} />
          ) : (
            <View>
              {/* Simple target circle for solo */}
              <View style={[styles.targetOuter, { borderColor: iconColor }]}>
                <View
                  style={[styles.targetInner, { backgroundColor: iconColor }]}
                />
              </View>
            </View>
          )}
        </View>
        <View style={styles.cardText}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            {title}
          </Text>
          <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
            {description}
          </Text>
          <View style={styles.tagRow}>
            {tags.map((tag) => (
              <View
                key={tag}
                style={[
                  styles.tag,
                  {
                    backgroundColor: tagColor.bg,
                    borderRadius: radius.full,
                  },
                ]}
              >
                <Text style={[styles.tagText, { color: tagColor.text }]}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <ChevronRightIcon size={20} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

export function StepMode({ onSelect }: StepModeProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: colors.textPrimary }]}>
        How do you want to challenge?
      </Text>
      <Text style={[styles.subheading, { color: colors.textSecondary }]}>
        You can always invite friends later.
      </Text>

      <View style={styles.cards}>
        <ModeCard
          mode="social"
          title="Challenge Friends"
          description="Compete on a leaderboard with friends"
          tags={["Leaderboard", "Rank Updates"]}
          tagColor={{ bg: "#D1FAE5", text: "#047857" }}
          iconBg={SOCIAL_ICON_COLOR.bg}
          iconColor={SOCIAL_ICON_COLOR.text}
          onPress={() => onSelect("social")}
        />

        <ModeCard
          mode="solo"
          title="Personal Goal"
          description="Set a target and track your own progress"
          tags={["Milestones", "Streaks"]}
          tagColor={{ bg: "#DBEAFE", text: "#1D4ED8" }}
          iconBg={TARGET_ICON_COLOR.bg}
          iconColor={TARGET_ICON_COLOR.text}
          onPress={() => onSelect("solo")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  heading: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  subheading: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 16,
  },
  cards: {
    gap: 12,
  },
  card: {
    padding: 16,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrap: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  targetOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  targetInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  cardDesc: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 2,
  },
  tagRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "500",
  },
});
