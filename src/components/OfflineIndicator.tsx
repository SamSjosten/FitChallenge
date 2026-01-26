// src/components/OfflineIndicator.tsx
// Visual indicator for offline state and pending queue
//
// GUARDRAIL 5: UI feedback for offline state

import React from "react";
import { View, Text, StyleSheet, Pressable, Animated } from "react-native";
import { CloudIcon } from "react-native-heroicons/outline";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOfflineStore } from "@/stores/offlineStore";
import { useTheme } from "@/constants/theme";

interface OfflineIndicatorProps {
  /** Compact mode for inline display */
  compact?: boolean;
}

/**
 * Visual indicator showing offline status and pending queue items.
 *
 * - When offline: Shows warning with queue count
 * - When online with pending items: Shows sync status with tap-to-retry
 * - When online with empty queue: Hidden
 */
export function OfflineIndicator({ compact = false }: OfflineIndicatorProps) {
  const { colors } = useTheme();
  const { isConnected } = useNetworkStatus();
  const queueLength = useOfflineStore((s) => s.queue.length);
  const isProcessing = useOfflineStore((s) => s.isProcessing);
  const processQueue = useOfflineStore((s) => s.processQueue);

  // Animated rotation for processing indicator
  const spinAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (isProcessing) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [isProcessing, spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // Don't show anything if online and queue is empty
  if (isConnected && queueLength === 0) {
    return null;
  }

  // Offline indicator
  if (!isConnected) {
    return (
      <View
        style={[
          styles.container,
          compact && styles.containerCompact,
          { backgroundColor: colors.warning },
        ]}
      >
        <CloudIcon
          size={compact ? 14 : 16}
          color={colors.textPrimary}
          strokeWidth={2}
        />
        {!compact && (
          <Text style={[styles.text, { color: colors.textPrimary }]}>
            Offline
            {queueLength > 0 && ` • ${queueLength} pending`}
          </Text>
        )}
      </View>
    );
  }

  // Online but has pending items (syncing)
  if (queueLength > 0) {
    return (
      <Pressable
        onPress={() => processQueue()}
        disabled={isProcessing}
        style={[
          styles.container,
          compact && styles.containerCompact,
          { backgroundColor: colors.primary.main },
        ]}
      >
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <CloudIcon
            size={compact ? 14 : 16}
            color={colors.textInverse}
            strokeWidth={2}
          />
        </Animated.View>
        {!compact && (
          <Text style={[styles.text, { color: colors.textInverse }]}>
            {isProcessing ? "Syncing..." : `${queueLength} to sync`}
          </Text>
        )}
      </Pressable>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  containerCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  text: {
    fontSize: 13,
    fontWeight: "500",
  },
});
