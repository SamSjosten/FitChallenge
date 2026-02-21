// app/(auth)/welcome.tsx
// Avvio Welcome Screen — Deep emerald hero with AVVIO wordmark,
// orbital arc background animation, diamond ornament, "NEVER SETTLE"
// subtitle, and synchronized single-flow entrance animation.
//
// Flow: Welcome → Auth (signup/signin) → Onboarding → Home
//
// ANIMATION ARCHITECTURE (single-flow, no crossfade):
// ────────────────────────────────────────────────────
// Full-screen gradient always present. AVVIO fades in centered,
// holds, slides up to hero while card rises in sync. Orbital arcs
// fade in after entrance and rotate continuously. ~2.6s to settle.
//
// ORBITAL ARCS (HAL 9000 energy):
// ────────────────────────────────
// 20 concentric arcs, each at a unique radius so they never cross.
// Random sweep lengths, speeds (30–85s/rev), and CW/CCW direction.
// Tightly packed (~11px spacing) for dense texture.

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Dimensions, Easing } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useAppTheme } from "@/providers/ThemeProvider";
import { UsersIcon, FireIcon, StarIcon } from "react-native-heroicons/solid";
import { Feather } from "@expo/vector-icons";
import { TestIDs } from "@/constants/testIDs";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// =============================================================================
// TIMING CONSTANTS
// =============================================================================

const TIMING = {
  titleFadeIn: 400,
  holdDuration: 800,
  slideDuration: 600,
  detailStagger: 100,
  detailDuration: 400,
} as const;

// =============================================================================
// DEEP EMERALD GRADIENT
// =============================================================================

const HERO_GRADIENT = {
  fullScreen: ["#065F46", "#047857", "#0D9488", "#0F766E"] as const,
  locations: [0, 0.35, 0.65, 1] as const,
};

// =============================================================================
// ORBITAL ARC GENERATION
// =============================================================================
// Seeded PRNG for reproducible "random" arcs across renders.

function seededRng(s: number) {
  let v = s;
  return () => {
    v = (v * 16807 + 0) % 2147483647;
    return (v & 0x7fffffff) / 0x7fffffff;
  };
}

interface ArcConfig {
  radius: number;
  startAngle: number;
  endAngle: number;
  strokeWidth: number;
  opacity: number;
  duration: number; // ms per full revolution
  direction: 1 | -1; // 1 = CW, -1 = CCW
}

function generateOrbitalArcs(): ArcConfig[] {
  const rng = seededRng(61);
  const arcs: ArcConfig[] = [];
  for (let i = 0; i < 20; i++) {
    const radius = 20 + i * 11 + (rng() - 0.5) * 4;
    const sweep = 0.3 + rng() * 2.8;
    const start = rng() * Math.PI * 2 - Math.PI;
    arcs.push({
      radius,
      startAngle: start,
      endAngle: start + sweep,
      strokeWidth: 0.3 + rng() * 1.4,
      opacity: 0.04 + rng() * 0.1,
      duration: (30 + rng() * 55) * 1000,
      direction: rng() > 0.5 ? 1 : -1,
    });
  }
  return arcs;
}

function buildArcPathData(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const steps = 40;
  const parts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = startAngle + (endAngle - startAngle) * t;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    parts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return parts.join(" ");
}

// =============================================================================
// ORBITAL ARCS COMPONENT
// =============================================================================
// Each arc renders inside its own Animated.View that fills the hero
// area. Rotation is applied to the View, whose center coincides
// with the arc center → rotation orbits the arc correctly.

function OrbitalArcs({
  heroWidth,
  heroHeight,
  fadeOpacity,
}: {
  heroWidth: number;
  heroHeight: number;
  fadeOpacity: Animated.Value;
}) {
  const arcs = useMemo(() => generateOrbitalArcs(), []);
  const cx = heroWidth / 2;
  const cy = heroHeight / 2;

  // One Animated.Value per arc for continuous rotation
  const rotations = useRef(arcs.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = arcs.map((arc: ArcConfig, i: number) =>
      Animated.loop(
        Animated.timing(rotations[i], {
          toValue: arc.direction,
          duration: arc.duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
    );
    animations.forEach((a: Animated.CompositeAnimation) => a.start());
    return () => animations.forEach((a: Animated.CompositeAnimation) => a.stop());
  }, []);

  return (
    <Animated.View style={[styles.orbitalContainer, { opacity: fadeOpacity }]} pointerEvents="none">
      {arcs.map((arc: ArcConfig, i: number) => {
        const rotate = rotations[i].interpolate({
          inputRange: [-1, 0, 1],
          outputRange: ["-360deg", "0deg", "360deg"],
        });

        return (
          <Animated.View
            key={i}
            style={[
              styles.orbitalArcWrapper,
              { width: heroWidth, height: heroHeight },
              { transform: [{ rotate }] },
            ]}
          >
            <Svg width={heroWidth} height={heroHeight} viewBox={`0 0 ${heroWidth} ${heroHeight}`}>
              <Path
                d={buildArcPathData(cx, cy, arc.radius, arc.startAngle, arc.endAngle)}
                stroke="#6EE7B7"
                strokeWidth={arc.strokeWidth}
                fill="none"
                opacity={arc.opacity}
                strokeLinecap="round"
              />
            </Svg>
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

// =============================================================================
// FEATURE ICONS CONFIG
// =============================================================================

type FeatureItem =
  | {
      type: "heroicon";
      icon: typeof UsersIcon;
      label: string;
      color: string;
      bgColor: string;
    }
  | {
      type: "feather";
      icon: string;
      label: string;
      color: string;
      bgColor: string;
    };

const welcomeFeatures: FeatureItem[] = [
  {
    type: "heroicon",
    icon: UsersIcon,
    label: "Social",
    color: "#3B82F6",
    bgColor: "#EFF6FF",
  },
  {
    type: "feather",
    icon: "target",
    label: "Goals",
    color: "#10B981",
    bgColor: "#ECFDF5",
  },
  {
    type: "heroicon",
    icon: FireIcon,
    label: "Streaks",
    color: "#F97316",
    bgColor: "#FFF7ED",
  },
  {
    type: "heroicon",
    icon: StarIcon,
    label: "Wins",
    color: "#F59E0B",
    bgColor: "#FFFBEB",
  },
];

function FeatureIcon({ item }: { item: FeatureItem }) {
  if (item.type === "heroicon") {
    const IconComponent = item.icon;
    return <IconComponent size={18} color={item.color} />;
  } else {
    return <Feather name={item.icon as any} size={18} color={item.color} />;
  }
}

// =============================================================================
// DIAMOND ORNAMENT
// =============================================================================

function DiamondOrnament({
  lineScale,
  diamondScale,
  diamondRotate,
}: {
  lineScale: Animated.Value;
  diamondScale: Animated.Value;
  diamondRotate: Animated.Value;
}) {
  const rotation = diamondRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  return (
    <View style={styles.ornamentContainer}>
      <Animated.View style={[styles.ornamentLine, { transform: [{ scaleX: lineScale }] }]} />
      <Animated.View
        style={[styles.diamond, { transform: [{ rotate: rotation }, { scale: diamondScale }] }]}
      />
      <Animated.View style={[styles.ornamentLine, { transform: [{ scaleX: lineScale }] }]} />
    </View>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function WelcomeScreen() {
  const { colors, shadows } = useAppTheme();
  const [isExiting, setIsExiting] = useState(false);

  // Phase 1: Splash
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleScale = useRef(new Animated.Value(0.92)).current;
  const splashBarScale = useRef(new Animated.Value(0)).current;
  const splashBarOpacity = useRef(new Animated.Value(0)).current;

  // Phase 2: Synchronized slide
  const titleSlide = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(60)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  // Phase 3: Details
  const topBarScale = useRef(new Animated.Value(0)).current;
  const orbitalOpacity = useRef(new Animated.Value(0)).current;
  const lineScale = useRef(new Animated.Value(0)).current;
  const diamondScale = useRef(new Animated.Value(0)).current;
  const diamondRotate = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleLetterSpacing = useRef(new Animated.Value(12)).current;

  // Title vertical position
  const heroHeight = SCREEN_H * 0.55;
  const heroCenter = heroHeight / 2;
  const screenCenter = SCREEN_H / 2;
  const slideDistance = screenCenter - heroCenter;

  const titleTranslateY = titleSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -slideDistance],
  });

  const runEntrance = useCallback(() => {
    // Reset all
    titleOpacity.setValue(0);
    titleScale.setValue(0.92);
    splashBarScale.setValue(0);
    splashBarOpacity.setValue(0);
    titleSlide.setValue(0);
    cardTranslateY.setValue(60);
    cardOpacity.setValue(0);
    topBarScale.setValue(0);
    orbitalOpacity.setValue(0);
    lineScale.setValue(0);
    diamondScale.setValue(0);
    diamondRotate.setValue(0);
    subtitleOpacity.setValue(0);
    subtitleLetterSpacing.setValue(12);
    setIsExiting(false);

    const easeOut = Easing.out(Easing.cubic);
    const easeInOut = Easing.inOut(Easing.cubic);

    Animated.sequence([
      // Phase 1: AVVIO fades in centered
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: TIMING.titleFadeIn,
          useNativeDriver: true,
        }),
        Animated.timing(titleScale, {
          toValue: 1,
          duration: TIMING.titleFadeIn,
          easing: easeOut,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(200),
          Animated.parallel([
            Animated.timing(splashBarScale, {
              toValue: 1,
              duration: 300,
              easing: easeOut,
              useNativeDriver: true,
            }),
            Animated.timing(splashBarOpacity, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]),

      // Hold
      Animated.delay(TIMING.holdDuration),

      // Phase 2: Synchronized slide
      Animated.parallel([
        Animated.timing(titleSlide, {
          toValue: 1,
          duration: TIMING.slideDuration,
          easing: easeInOut,
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslateY, {
          toValue: 0,
          duration: TIMING.slideDuration,
          easing: easeInOut,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: TIMING.slideDuration,
          easing: easeInOut,
          useNativeDriver: true,
        }),
        Animated.timing(splashBarOpacity, {
          toValue: 0,
          duration: TIMING.slideDuration * 0.5,
          useNativeDriver: true,
        }),
        Animated.timing(splashBarScale, {
          toValue: 0.3,
          duration: TIMING.slideDuration * 0.5,
          useNativeDriver: true,
        }),
      ]),

      // Phase 3: Detail elements
      Animated.parallel([
        // Top accent bar
        Animated.timing(topBarScale, {
          toValue: 1,
          duration: TIMING.detailDuration,
          easing: easeOut,
          useNativeDriver: true,
        }),
        // Orbital arcs fade in
        Animated.timing(orbitalOpacity, {
          toValue: 1,
          duration: TIMING.detailDuration + 400,
          useNativeDriver: true,
        }),
        // Diamond ornament (staggered)
        Animated.sequence([
          Animated.delay(TIMING.detailStagger),
          Animated.timing(lineScale, {
            toValue: 1,
            duration: TIMING.detailDuration,
            easing: easeOut,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(TIMING.detailStagger * 2),
          Animated.parallel([
            Animated.spring(diamondScale, {
              toValue: 1,
              tension: 200,
              friction: 12,
              useNativeDriver: true,
            }),
            Animated.timing(diamondRotate, {
              toValue: 1,
              duration: TIMING.detailDuration + 100,
              easing: easeOut,
              useNativeDriver: true,
            }),
          ]),
        ]),
        // NEVER SETTLE subtitle
        Animated.sequence([
          Animated.delay(TIMING.detailStagger * 3),
          Animated.parallel([
            Animated.timing(subtitleOpacity, {
              toValue: 0.5,
              duration: TIMING.detailDuration + 200,
              useNativeDriver: true,
            }),
            Animated.timing(subtitleLetterSpacing, {
              toValue: 4,
              duration: TIMING.detailDuration + 200,
              easing: easeOut,
              useNativeDriver: false,
            }),
          ]),
        ]),
      ]),
    ]).start();
  }, []);

  useEffect(() => {
    runEntrance();
  }, [runEntrance]);

  useFocusEffect(
    useCallback(() => {
      runEntrance();
    }, [runEntrance]),
  );

  const handleGetStarted = () => {
    if (isExiting) return;
    setIsExiting(true);
    router.push("/(auth)/auth?mode=signup");
  };

  const handleSignIn = () => {
    if (isExiting) return;
    setIsExiting(true);
    router.push("/(auth)/auth?mode=signin");
  };

  return (
    <Animated.View testID={TestIDs.screens.welcome} style={[styles.container]}>
      {/* Full-screen gradient — no color seams */}
      <LinearGradient
        colors={[...HERO_GRADIENT.fullScreen]}
        locations={[...HERO_GRADIENT.locations]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.3, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Hero area */}
      <View style={styles.heroSection}>
        {/* Orbital arcs — continuous rotation, clipped to hero */}
        <OrbitalArcs heroWidth={SCREEN_W} heroHeight={heroHeight} fadeOpacity={orbitalOpacity} />

        {/* Top accent bar */}
        <Animated.View style={[styles.topAccentBar, { transform: [{ scaleX: topBarScale }] }]} />
      </View>

      {/* AVVIO title — starts centered, slides to hero */}
      <Animated.View
        style={[
          styles.titleContainer,
          {
            opacity: titleOpacity,
            transform: [{ translateY: titleTranslateY }, { scale: titleScale }],
          },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.avvioTitle}>AVVIO</Text>
      </Animated.View>

      {/* Splash accent bar — under centered title */}
      <Animated.View
        style={[
          styles.splashBar,
          {
            opacity: splashBarOpacity,
            transform: [{ scaleX: splashBarScale }],
          },
        ]}
        pointerEvents="none"
      />

      {/* Diamond ornament + NEVER SETTLE (hero position) */}
      <View style={styles.heroOrnamentArea}>
        <DiamondOrnament
          lineScale={lineScale}
          diamondScale={diamondScale}
          diamondRotate={diamondRotate}
        />
        <Animated.View style={{ opacity: subtitleOpacity }}>
          <Animated.Text style={[styles.subtitle, { letterSpacing: subtitleLetterSpacing }]}>
            NEVER SETTLE
          </Animated.Text>
        </Animated.View>
      </View>

      {/* White bottom card — rises in sync with title slide */}
      <Animated.View
        style={[
          styles.bottomCard,
          {
            backgroundColor: colors.surface,
            opacity: cardOpacity,
            transform: [{ translateY: cardTranslateY }],
          },
        ]}
      >
        <Text style={[styles.headline, { color: colors.textPrimary }]}>
          Your Fitness Journey,{"\n"}Together
        </Text>
        <Text style={[styles.subheadline, { color: colors.textSecondary }]}>
          Challenge friends, track your progress, and celebrate every win
        </Text>

        <View style={styles.featuresRow}>
          {welcomeFeatures.map((item, i) => (
            <View key={i} style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: item.bgColor }]}>
                <FeatureIcon item={item} />
              </View>
              <Text style={[styles.featureLabel, { color: colors.textMuted }]}>{item.label}</Text>
            </View>
          ))}
        </View>

        <Pressable
          testID={TestIDs.welcome.getStartedButton}
          onPress={handleGetStarted}
          disabled={isExiting}
          style={({ pressed }: { pressed: boolean }) => [
            styles.primaryButton,
            {
              backgroundColor: colors.primary.main,
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
              ...shadows.button,
            },
          ]}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </Pressable>

        <Pressable
          testID={TestIDs.welcome.signInLink}
          onPress={handleSignIn}
          style={styles.signInLink}
        >
          <Text style={[styles.signInText, { color: colors.textMuted }]}>
            Already have an account?{" "}
            <Text style={{ color: colors.primary.main, fontWeight: "600" }}>Sign in</Text>
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroSection: {
    height: "55%",
    position: "relative",
    overflow: "hidden",
  },

  // ─── Orbital arcs ───
  orbitalContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  orbitalArcWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
  },

  // ─── Top accent bar ───
  topAccentBar: {
    position: "absolute",
    top: "50%",
    alignSelf: "center",
    marginTop: -58,
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#34D399",
    opacity: 0.6,
  },

  // ─── AVVIO title ───
  titleContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  avvioTitle: {
    fontSize: 52,
    fontFamily: "PlusJakartaSans_800ExtraBold",
    color: "#FFFFFF",
    letterSpacing: -2,
  },

  // ─── Splash accent bar ───
  splashBar: {
    position: "absolute",
    top: "50%",
    alignSelf: "center",
    marginTop: 20,
    width: 32,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#34D399",
    opacity: 0.5,
  },

  // ─── Diamond ornament area ───
  heroOrnamentArea: {
    position: "absolute",
    top: "27.5%",
    left: 0,
    right: 0,
    alignItems: "center",
    marginTop: 20,
    zIndex: 5,
  },
  ornamentContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ornamentLine: {
    width: 40,
    height: 1,
    backgroundColor: "#34D399",
    opacity: 0.35,
  },
  diamond: {
    width: 7,
    height: 7,
    borderRadius: 1,
    backgroundColor: "#34D399",
    opacity: 0.5,
  },

  // ─── NEVER SETTLE subtitle ───
  subtitle: {
    marginTop: 12,
    fontSize: 11,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "#FFFFFF",
  },

  // ─── Bottom card ───
  bottomCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 48,
    alignItems: "center",
  },
  headline: {
    fontSize: 24,
    fontFamily: "PlusJakartaSans_700Bold",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 32,
  },
  subheadline: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_400Regular",
    textAlign: "center",
    marginBottom: 24,
    maxWidth: 280,
    lineHeight: 22,
  },
  featuresRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    marginBottom: 32,
  },
  featureItem: {
    alignItems: "center",
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  featureLabel: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  primaryButton: {
    width: "100%",
    maxWidth: 320,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  signInLink: {
    paddingVertical: 8,
  },
  signInText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
  },
});
