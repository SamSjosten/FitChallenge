// src/components/v2/create/StepSuccess.tsx
// Success screen after challenge creation

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import type { StepSuccessProps } from "./types";

export function StepSuccess({
  mode,
  challengeName,
  inviteCount,
  onDone,
}: StepSuccessProps) {
  const { colors, radius } = useAppTheme();

  const emoji = mode === "solo" ? "🎯" : "🎉";
  const title = mode === "solo" ? "Goal Created!" : "Challenge Created!";
  const subtitle =
    mode === "solo"
      ? "Your personal goal is set. Time to get moving!"
      : inviteCount > 0
        ? `Invites sent to ${inviteCount} friend${inviteCount !== 1 ? "s" : ""}.`
        : "Invite friends whenever you're ready.";

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {title}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {subtitle}
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={onDone}
          activeOpacity={0.8}
          style={[
            styles.button,
            {
              backgroundColor: colors.primary.main,
              borderRadius: radius.xl,
            },
          ]}
        >
          <Text style={[styles.buttonText, { color: colors.primary.contrast }]}>
            Done
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  button: {
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "600",
  },
});
