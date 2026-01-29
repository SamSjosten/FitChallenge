// src/components/icons/ActivityIcons.tsx
// Custom activity icons for workout types
// These complement heroicons where specific activity icons aren't available

import React from "react";
import Svg, { Path, Circle, G } from "react-native-svg";

interface IconProps {
  size?: number;
  color?: string;
}

// Footprints / Steps icon
export function FootprintsIcon({ size = 24, color = "#000" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 16.5C4 15.1193 5.11929 14 6.5 14C7.88071 14 9 15.1193 9 16.5V19C9 20.1046 8.10457 21 7 21H6C4.89543 21 4 20.1046 4 19V16.5Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.5 14V10C6.5 8.34315 7.84315 7 9.5 7C11.1569 7 12.5 8.34315 12.5 10V12"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15 16.5C15 15.1193 16.1193 14 17.5 14C18.8807 14 20 15.1193 20 16.5V19C20 20.1046 19.1046 21 18 21H17C15.8954 21 15 20.1046 15 19V16.5Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M17.5 14V8C17.5 6.34315 16.1569 5 14.5 5C12.8431 5 11.5 6.34315 11.5 8V10"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Dumbbell / Strength icon
export function DumbbellIcon({ size = 24, color = "#000" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6.5 6.5V17.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M17.5 6.5V17.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M6.5 12H17.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M3 8V16"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M21 8V16"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M4.5 7V17"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M19.5 7V17"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// Running / Distance icon
export function RunningIcon({ size = 24, color = "#000" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="17" cy="4" r="2" stroke={color} strokeWidth={1.5} />
      <Path
        d="M15 22L12 16L8 18L4 21"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 11L10 9L14 11L18 7"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10 9L8 13L12 16"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Cycling / Bike icon
export function CyclingIcon({ size = 24, color = "#000" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="5.5" cy="17.5" r="3.5" stroke={color} strokeWidth={1.5} />
      <Circle cx="18.5" cy="17.5" r="3.5" stroke={color} strokeWidth={1.5} />
      <Path
        d="M5.5 17.5L8.5 9.5H15L18.5 17.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 17.5V9.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Circle cx="15" cy="6" r="2" stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

// Yoga / Flexibility icon
export function YogaIcon({ size = 24, color = "#000" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="5" r="2" stroke={color} strokeWidth={1.5} />
      <Path
        d="M12 7V13"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M12 13L7 18"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M12 13L17 18"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M8 9L12 11L16 9"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// HIIT / High Intensity icon
export function HIITIcon({ size = 24, color = "#000" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 3L4 14H12L11 21L20 10H12L13 3Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Swimming icon
export function SwimmingIcon({ size = 24, color = "#000" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="8" cy="6" r="2" stroke={color} strokeWidth={1.5} />
      <Path
        d="M3 18C4.5 16.5 6 16.5 7.5 18C9 19.5 10.5 19.5 12 18C13.5 16.5 15 16.5 16.5 18C18 19.5 19.5 19.5 21 18"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6 12L8 10L14 10L17 13"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Generic Activity icon
export function ActivityIcon({ size = 24, color = "#000" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 12H18L15 21L9 3L6 12H2"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Map activity type to icon component
export type ActivityType =
  | "steps"
  | "workouts"
  | "workout_points"
  | "distance"
  | "active_minutes"
  | "strength"
  | "running"
  | "yoga"
  | "hiit"
  | "cycling"
  | "walking"
  | "swimming"
  | "custom";

export function getActivityIcon(
  type: ActivityType,
): React.ComponentType<IconProps> {
  const iconMap: Record<ActivityType, React.ComponentType<IconProps>> = {
    steps: FootprintsIcon,
    walking: FootprintsIcon,
    workouts: DumbbellIcon,
    workout_points: DumbbellIcon,
    strength: DumbbellIcon,
    distance: RunningIcon,
    running: RunningIcon,
    active_minutes: ActivityIcon,
    yoga: YogaIcon,
    hiit: HIITIcon,
    cycling: CyclingIcon,
    swimming: SwimmingIcon,
    custom: ActivityIcon,
  };

  return iconMap[type] || ActivityIcon;
}

// Activity type colors for backgrounds
export const activityColors: Record<
  ActivityType,
  { text: string; bg: string }
> = {
  steps: { text: "#3B82F6", bg: "#DBEAFE" }, // Blue
  walking: { text: "#10B981", bg: "#D1FAE5" }, // Emerald
  workouts: { text: "#8B5CF6", bg: "#EDE9FE" }, // Purple
  workout_points: { text: "#8B5CF6", bg: "#EDE9FE" }, // Purple
  strength: { text: "#8B5CF6", bg: "#EDE9FE" }, // Purple
  distance: { text: "#0D9488", bg: "#CCFBF1" }, // Teal
  running: { text: "#3B82F6", bg: "#DBEAFE" }, // Blue
  active_minutes: { text: "#F97316", bg: "#FFEDD5" }, // Orange
  yoga: { text: "#22C55E", bg: "#DCFCE7" }, // Green
  hiit: { text: "#F97316", bg: "#FFEDD5" }, // Orange
  cycling: { text: "#06B6D4", bg: "#CFFAFE" }, // Cyan
  swimming: { text: "#0EA5E9", bg: "#E0F2FE" }, // Sky
  custom: { text: "#6B7280", bg: "#F3F4F6" }, // Gray
};
