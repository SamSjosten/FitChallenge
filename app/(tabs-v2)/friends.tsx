// app/(tabs-v2)/friends.tsx
// V2 Friends Screen - Placeholder
//
// Will be implemented in Phase 2B with:
// - Search bar
// - Friend requests section
// - Friends list with invite actions

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/providers/ThemeProvider";
import { TestIDs } from "@/constants/testIDs";

export default function FriendsScreenV2() {
  const { colors } = useAppTheme();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      testID={TestIDs.screensV2?.friends || "friends-screen-v2"}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Friends V2
        </Text>
      </View>

      <View style={styles.content}>
        <View
          style={[
            styles.placeholder,
            { borderColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          <Text
            style={[styles.placeholderText, { color: colors.textSecondary }]}
          >
            V2 Friends Screen
          </Text>
          <Text
            style={[styles.placeholderSubtext, { color: colors.textMuted }]}
          >
            Phase 2B Implementation
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  placeholder: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontSize: 18,
    fontFamily: "PlusJakartaSans_600SemiBold",
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
  },
});
