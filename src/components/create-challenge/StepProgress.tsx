// src/components/create-challenge/StepProgress.tsx
// Step progress indicator for multi-step create flow

import React from "react";
import { View, StyleSheet } from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";

interface StepProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function StepProgress({ currentStep, totalSteps }: StepProgressProps) {
  const { colors, radius } = useAppTheme();

  return (
    <View style={styles.container}>
      {Array.from({ length: totalSteps }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor:
                i < currentStep
                  ? colors.primary.main
                  : i === currentStep
                    ? colors.primary.main
                    : colors.border,
              borderRadius: radius.full,
              opacity: i <= currentStep ? 1 : 0.4,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  dot: {
    width: 8,
    height: 8,
  },
});
