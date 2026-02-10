// src/components/FaceIDIcon.tsx
// Custom Face ID icon that matches Apple's design (with the smiley face)
// Ionicons' "scan" icon only has the corner brackets, not the face

import React from "react";
import { View, StyleSheet } from "react-native";

interface FaceIDIconProps {
  size?: number;
  color?: string;
}

export function FaceIDIcon({ size = 48, color = "#10B981" }: FaceIDIconProps) {
  const strokeWidth = size * 0.06;
  const cornerSize = size * 0.25;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Top-left corner */}
      <View style={styles.topLeft}>
        <View
          style={[
            styles.horizontalBar,
            {
              width: cornerSize,
              height: strokeWidth,
              backgroundColor: color,
              borderRadius: strokeWidth / 2,
            },
          ]}
        />
        <View
          style={[
            styles.verticalBar,
            {
              width: strokeWidth,
              height: cornerSize,
              backgroundColor: color,
              borderRadius: strokeWidth / 2,
            },
          ]}
        />
      </View>

      {/* Top-right corner */}
      <View style={styles.topRight}>
        <View
          style={[
            styles.horizontalBar,
            {
              width: cornerSize,
              height: strokeWidth,
              backgroundColor: color,
              borderRadius: strokeWidth / 2,
              alignSelf: "flex-end",
            },
          ]}
        />
        <View
          style={[
            styles.verticalBar,
            {
              width: strokeWidth,
              height: cornerSize,
              backgroundColor: color,
              borderRadius: strokeWidth / 2,
              alignSelf: "flex-end",
            },
          ]}
        />
      </View>

      {/* Bottom-left corner */}
      <View style={styles.bottomLeft}>
        <View
          style={[
            styles.verticalBar,
            {
              width: strokeWidth,
              height: cornerSize,
              backgroundColor: color,
              borderRadius: strokeWidth / 2,
            },
          ]}
        />
        <View
          style={[
            styles.horizontalBar,
            {
              width: cornerSize,
              height: strokeWidth,
              backgroundColor: color,
              borderRadius: strokeWidth / 2,
              position: "absolute",
              bottom: 0,
            },
          ]}
        />
      </View>

      {/* Bottom-right corner */}
      <View style={styles.bottomRight}>
        <View
          style={[
            styles.verticalBar,
            {
              width: strokeWidth,
              height: cornerSize,
              backgroundColor: color,
              borderRadius: strokeWidth / 2,
              alignSelf: "flex-end",
            },
          ]}
        />
        <View
          style={[
            styles.horizontalBar,
            {
              width: cornerSize,
              height: strokeWidth,
              backgroundColor: color,
              borderRadius: strokeWidth / 2,
              alignSelf: "flex-end",
              position: "absolute",
              bottom: 0,
            },
          ]}
        />
      </View>

      {/* Face */}
      <View style={styles.faceContainer}>
        {/* Eyes */}
        <View style={[styles.eyesContainer, { gap: size * 0.15, marginBottom: size * 0.08 }]}>
          <View
            style={[
              styles.eye,
              {
                width: size * 0.08,
                height: size * 0.12,
                backgroundColor: color,
                borderRadius: size * 0.04,
              },
            ]}
          />
          <View
            style={[
              styles.eye,
              {
                width: size * 0.08,
                height: size * 0.12,
                backgroundColor: color,
                borderRadius: size * 0.04,
              },
            ]}
          />
        </View>

        {/* Smile */}
        <View
          style={[
            styles.smile,
            {
              width: size * 0.25,
              height: size * 0.12,
              borderBottomWidth: strokeWidth,
              borderLeftWidth: strokeWidth,
              borderRightWidth: strokeWidth,
              borderColor: color,
              borderBottomLeftRadius: size * 0.15,
              borderBottomRightRadius: size * 0.15,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
  topLeft: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  topRight: {
    position: "absolute",
    top: 0,
    right: 0,
  },
  bottomLeft: {
    position: "absolute",
    bottom: 0,
    left: 0,
  },
  bottomRight: {
    position: "absolute",
    bottom: 0,
    right: 0,
  },
  horizontalBar: {},
  verticalBar: {},
  faceContainer: {
    alignItems: "center",
  },
  eyesContainer: {
    flexDirection: "row",
  },
  eye: {},
  smile: {},
});

export default FaceIDIcon;
