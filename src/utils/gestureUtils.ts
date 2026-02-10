// src/utils/gestureUtils.ts
// Pure utility functions for gesture handling
// These are extracted for testability and reuse across gesture-enabled components
//
// IMPORTANT: NO React Native dependencies - safe to import in Node unit tests
// Screen-specific values are passed as parameters or computed at component level

// =============================================================================
// CONSTANTS (device-independent)
// =============================================================================

// Base threshold in density-independent pixels (dp)
// Actual threshold is calculated at component level based on device density
export const BASE_SWIPE_THRESHOLD_DP = 80;
export const MIN_SWIPE_THRESHOLD = 60;
export const MAX_SWIPE_THRESHOLD = 120;

// Gesture capture thresholds - used to configure react-native-gesture-handler
// These are NOT used in pure functions; they configure the gesture handler directly
export const HORIZONTAL_ACTIVE_OFFSET = 15;
export const VERTICAL_FAIL_OFFSET = 25;

// Animation durations (ms)
export const DISMISS_ANIMATION_DURATION = 200;
export const SPRING_DAMPING = 15;

// =============================================================================
// PURE FUNCTIONS (actually used at runtime)
// =============================================================================

/**
 * Calculates density-aware swipe threshold
 * @param pixelRatio - Device pixel ratio (from PixelRatio.get())
 */
export function calculateSwipeThreshold(pixelRatio: number): number {
  return Math.min(
    MAX_SWIPE_THRESHOLD,
    Math.max(MIN_SWIPE_THRESHOLD, (BASE_SWIPE_THRESHOLD_DP * pixelRatio) / 2),
  );
}

/**
 * Determines if a swipe should trigger dismiss
 * USED IN: NotificationRow.tsx onUpdate() for haptic trigger check
 *
 * @param translationX - Current horizontal translation (negative = left)
 * @param threshold - Minimum distance to trigger dismiss
 */
export function shouldDismiss(translationX: number, threshold: number): boolean {
  "worklet";
  return translationX < -threshold;
}

/**
 * Clamps translation to left-only swipe (blocks right swipe)
 * USED IN: NotificationRow.tsx onUpdate() to constrain translateX.value
 *
 * @param translationX - Raw horizontal translation
 */
export function clampTranslation(translationX: number): number {
  "worklet";
  return Math.min(0, translationX);
}

/**
 * Calculates the final position after swipe release
 * USED IN: NotificationRow.tsx onEnd() to determine animation target
 *
 * @param translationX - Final horizontal translation
 * @param threshold - Dismiss threshold
 * @param screenWidth - Screen width for off-screen animation
 */
export function calculateFinalPosition(
  translationX: number,
  threshold: number,
  screenWidth: number,
): { position: number; shouldDismiss: boolean } {
  "worklet";
  const dismiss = shouldDismiss(translationX, threshold);
  return {
    position: dismiss ? -screenWidth : 0,
    shouldDismiss: dismiss,
  };
}

// =============================================================================
// NOTE: shouldCaptureGesture is intentionally NOT included here
// =============================================================================
// Gesture capture is configured via react-native-gesture-handler methods:
//   .activeOffsetX([-HORIZONTAL_ACTIVE_OFFSET, HORIZONTAL_ACTIVE_OFFSET])
//   .failOffsetY([-VERTICAL_FAIL_OFFSET, VERTICAL_FAIL_OFFSET])
//
// A pure function would be misleading - it would be tested but not used.
// The constants above ARE used in the configuration.
// =============================================================================
