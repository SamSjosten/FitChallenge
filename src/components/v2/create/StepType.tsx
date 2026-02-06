// src/components/v2/create/StepType.tsx
// Step 1: Select challenge/activity type

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import { ChevronRightIcon } from "react-native-heroicons/outline";
import { HeartIcon as HeartIconSolid } from "react-native-heroicons/solid";
import {
  getActivityIcon,
  activityColors,
  type ActivityType,
} from "@/components/icons/ActivityIcons";
import { CHALLENGE_TYPES, type StepTypeProps } from "./types";
import type { ChallengeType } from "@/types/database";

export function StepType({ mode, onSelect, onBack }: StepTypeProps) {
  const { colors, radius } = useAppTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: colors.textPrimary }]}>
        What do you want to track?
      </Text>

      <View style={styles.list}>
        {CHALLENGE_TYPES.map((type) => {
          const Icon = getActivityIcon(type.id as ActivityType);
          const typeColors =
            activityColors[type.id as ActivityType] || activityColors.custom;

          return (
            <TouchableOpacity
              key={type.id}
              onPress={() => onSelect(type.id)}
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
                    {
                      backgroundColor: typeColors.bg,
                      borderRadius: radius.xl,
                    },
                  ]}
                >
                  <Icon size={24} color={typeColors.text} />
                </View>

                <View style={styles.cardText}>
                  <Text
                    style={[styles.cardTitle, { color: colors.textPrimary }]}
                  >
                    {type.name}
                  </Text>
                  <Text
                    style={[styles.cardDesc, { color: colors.textSecondary }]}
                  >
                    {type.desc}
                  </Text>
                  <View style={styles.syncRow}>
                    {type.autoSync ? (
                      <>
                        <HeartIconSolid size={14} color="#EC4899" />
                        <Text
                          style={[
                            styles.syncText,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Syncs from Apple Health
                        </Text>
                      </>
                    ) : (
                      <Text
                        style={[
                          styles.syncText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        📝 Manual entry required
                      </Text>
                    )}
                  </View>
                </View>

                <ChevronRightIcon
                  size={20}
                  color={colors.textMuted}
                  style={styles.chevron}
                />
              </View>
            </TouchableOpacity>
          );
        })}
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
    marginBottom: 16,
  },
  list: {
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
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  syncText: {
    fontSize: 12,
    fontWeight: "500",
  },
  chevron: {
    marginTop: 4,
  },
});
