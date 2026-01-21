// src/components/ServerTimeBanner.tsx
// Displays a non-blocking warning when server time sync fails
//
// Shows warning when:
// - Never synced + recent failure (no baseline, ongoing problem)
// - Optional subtle indicator when synced but now failing (degraded)
//
// Allows tap-to-retry for user-initiated resync attempts.

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import { useServerTimeSyncStatus, syncServerTime } from "@/lib/serverTime";
import { spacing, typography, radius } from "@/constants/theme";

/**
 * Non-blocking banner displayed when server time sync fails.
 *
 * Priority: Only shows critical warning (never synced + error).
 * Does NOT show when we have a baseline offset but are just stale,
 * as the cached offset is likely still reasonably accurate.
 */
export function ServerTimeBanner() {
  const { colors } = useAppTheme();
  const { hasSynced, lastError } = useServerTimeSyncStatus();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = useCallback(async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await syncServerTime({ force: true });
    } finally {
      setRetrying(false);
    }
  }, [retrying]);

  // Only show banner if we've NEVER synced and there's an error
  // This means we have no baseline offset at all - highest risk scenario
  const shouldShow = !hasSynced && lastError !== null;

  if (!shouldShow) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.warning }]}
      onPress={handleRetry}
      disabled={retrying}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Time sync unavailable. Tap to retry."
      accessibilityHint="Challenge times may be inaccurate"
    >
      <View style={styles.content}>
        <Text style={[styles.icon]}>⚠️</Text>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.textInverse }]}>
            Time sync unavailable
          </Text>
          <Text style={[styles.subtitle, { color: colors.textInverse }]}>
            Challenge times may be inaccurate. Tap to retry.
          </Text>
        </View>
        {retrying && (
          <ActivityIndicator
            size="small"
            color={colors.textInverse}
            style={styles.spinner}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: typography.textStyles.label.fontSize,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontWeight: "600",
  },
  subtitle: {
    fontSize: typography.textStyles.caption.fontSize,
    fontFamily: "PlusJakartaSans_500Medium",
    opacity: 0.9,
    marginTop: 1,
  },
  spinner: {
    marginLeft: spacing.sm,
  },
});
