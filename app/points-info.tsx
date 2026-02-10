// app/points-info.tsx
// Points Explainer Screen - How points are calculated
// Design System v2.0

import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { router, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/providers/ThemeProvider";
import {
  ChevronLeftIcon,
  TrophyIcon,
  FireIcon,
  SparklesIcon,
  QuestionMarkCircleIcon,
} from "react-native-heroicons/outline";
import { FootprintsIcon, DumbbellIcon, RunningIcon } from "@/components/icons/ActivityIcons";

interface PointsRuleProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  example: string;
  points: string;
}

function PointsRule({ icon, title, description, example, points }: PointsRuleProps) {
  const { colors, spacing, radius } = useAppTheme();

  return (
    <View
      style={[
        styles.ruleCard,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.md,
          marginBottom: spacing.sm,
        },
      ]}
    >
      <View style={styles.ruleHeader}>
        <View
          style={[
            styles.ruleIcon,
            {
              backgroundColor: colors.primary.subtle,
              borderRadius: radius.md,
            },
          ]}
        >
          {icon}
        </View>
        <View style={styles.ruleHeaderText}>
          <Text style={[styles.ruleTitle, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[styles.rulePoints, { color: colors.primary.main }]}>{points}</Text>
        </View>
      </View>
      <Text style={[styles.ruleDescription, { color: colors.textSecondary }]}>{description}</Text>
      <View
        style={[
          styles.exampleBox,
          {
            backgroundColor: colors.surfaceElevated,
            borderRadius: radius.md,
            marginTop: spacing.sm,
            padding: spacing.sm,
          },
        ]}
      >
        <Text style={[styles.exampleLabel, { color: colors.textMuted }]}>Example:</Text>
        <Text style={[styles.exampleText, { color: colors.textSecondary }]}>{example}</Text>
      </View>
    </View>
  );
}

interface FAQItemProps {
  question: string;
  answer: string;
}

function FAQItem({ question, answer }: FAQItemProps) {
  const { colors, spacing, radius } = useAppTheme();
  const [expanded, setExpanded] = React.useState(false);

  return (
    <TouchableOpacity
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
      style={[
        styles.faqItem,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.md,
          marginBottom: spacing.sm,
        },
      ]}
    >
      <View style={styles.faqHeader}>
        <QuestionMarkCircleIcon size={20} color={colors.primary.main} />
        <Text style={[styles.faqQuestion, { color: colors.textPrimary }]}>{question}</Text>
      </View>
      {expanded && (
        <Text style={[styles.faqAnswer, { color: colors.textSecondary, marginTop: spacing.sm }]}>
          {answer}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function PointsExplainerScreen() {
  const { colors, spacing, radius } = useAppTheme();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeftIcon size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>How Points Work</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro section */}
        <View
          style={[
            styles.introCard,
            {
              backgroundColor: colors.primary.subtle,
              borderRadius: radius.xl,
              padding: spacing.lg,
              marginBottom: spacing.xl,
            },
          ]}
        >
          <View style={styles.introIcon}>
            <TrophyIcon size={32} color={colors.primary.main} />
          </View>
          <Text style={[styles.introTitle, { color: colors.primary.main }]}>
            Earn Points, Win Challenges
          </Text>
          <Text style={[styles.introText, { color: colors.textSecondary }]}>
            Every activity you log earns points. The more you move, the more you score! Points help
            you compete in challenges and build your streak.
          </Text>
        </View>

        {/* Activity Points Section */}
        <Text
          style={[styles.sectionTitle, { color: colors.textSecondary, marginBottom: spacing.sm }]}
        >
          ACTIVITY POINTS
        </Text>

        <PointsRule
          icon={<FootprintsIcon size={20} color={colors.primary.main} />}
          title="Steps"
          description="Every step counts! Walk, run, or hike your way to more points."
          example="10,000 steps = 100 points"
          points="1 pt per 100 steps"
        />

        <PointsRule
          icon={<DumbbellIcon size={20} color={colors.primary.main} />}
          title="Workouts"
          description="Complete any workout to earn a flat bonus. Strength, yoga, HIIT - they all count!"
          example="1 workout = 10 points"
          points="10 pts per workout"
        />

        <PointsRule
          icon={<RunningIcon size={20} color={colors.primary.main} />}
          title="Distance"
          description="Log your running, cycling, or swimming distance."
          example="5 miles = 25 points"
          points="5 pts per mile"
        />

        <PointsRule
          icon={<FireIcon size={20} color={colors.primary.main} />}
          title="Active Minutes"
          description="Time spent being active. Any movement that gets your heart rate up!"
          example="30 active minutes = 30 points"
          points="1 pt per minute"
        />

        {/* Bonus Points Section */}
        <Text
          style={[
            styles.sectionTitle,
            {
              color: colors.textSecondary,
              marginTop: spacing.xl,
              marginBottom: spacing.sm,
            },
          ]}
        >
          BONUS POINTS
        </Text>

        <View
          style={[
            styles.bonusCard,
            {
              backgroundColor: colors.energy.subtle,
              borderRadius: radius.xl,
              padding: spacing.md,
              marginBottom: spacing.sm,
            },
          ]}
        >
          <View style={styles.bonusHeader}>
            <SparklesIcon size={24} color={colors.energy.dark} />
            <Text style={[styles.bonusTitle, { color: colors.energy.dark }]}>
              Streak Multiplier
            </Text>
          </View>
          <Text style={[styles.bonusDescription, { color: colors.textSecondary }]}>
            Keep your streak alive! After 7 days, you{"'"}ll earn bonus points on every activity.
          </Text>
          <View style={[styles.bonusTiers, { marginTop: spacing.sm }]}>
            <View style={styles.bonusTier}>
              <Text style={[styles.bonusTierLabel, { color: colors.textMuted }]}>7+ days</Text>
              <Text style={[styles.bonusTierValue, { color: colors.energy.dark }]}>+10%</Text>
            </View>
            <View style={styles.bonusTier}>
              <Text style={[styles.bonusTierLabel, { color: colors.textMuted }]}>30+ days</Text>
              <Text style={[styles.bonusTierValue, { color: colors.energy.dark }]}>+25%</Text>
            </View>
            <View style={styles.bonusTier}>
              <Text style={[styles.bonusTierLabel, { color: colors.textMuted }]}>100+ days</Text>
              <Text style={[styles.bonusTierValue, { color: colors.energy.dark }]}>+50%</Text>
            </View>
          </View>
        </View>

        {/* FAQ Section */}
        <Text
          style={[
            styles.sectionTitle,
            {
              color: colors.textSecondary,
              marginTop: spacing.xl,
              marginBottom: spacing.sm,
            },
          ]}
        >
          FREQUENTLY ASKED QUESTIONS
        </Text>

        <FAQItem
          question="Can I earn points from multiple devices?"
          answer="Yes! FitChallenge syncs with Apple Health and Google Fit, so your activities are automatically tracked regardless of which device you use. We use smart deduplication to ensure you don't get double points."
        />

        <FAQItem
          question="What happens if I forget to log an activity?"
          answer="If you're connected to Apple Health or Google Fit, your activities are automatically synced. For manual logging, you can add activities after the fact, but they'll only count toward challenges that were active at that time."
        />

        <FAQItem
          question="Do all challenges use the same point system?"
          answer="Most challenges use the standard point system described above. However, challenge creators can set specific goals like 'total steps' or 'workout count' which may have their own rules."
        />

        <FAQItem
          question="Can I lose points?"
          answer="No, once earned, points are yours to keep! Your total XP represents your lifetime activity in FitChallenge. Challenge-specific progress may reset between challenges, but your overall profile XP never decreases."
        />

        {/* Bottom spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  headerRight: {
    width: 32,
  },
  scrollContent: {
    flexGrow: 1,
  },
  introCard: {
    alignItems: "center",
  },
  introIcon: {
    marginBottom: 12,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  introText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  ruleCard: {},
  ruleHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  ruleIcon: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  ruleHeaderText: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginLeft: 12,
  },
  ruleTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  rulePoints: {
    fontSize: 14,
    fontWeight: "600",
  },
  ruleDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  exampleBox: {},
  exampleLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginBottom: 2,
  },
  exampleText: {
    fontSize: 13,
  },
  bonusCard: {},
  bonusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  bonusTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  bonusDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  bonusTiers: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  bonusTier: {
    alignItems: "center",
  },
  bonusTierLabel: {
    fontSize: 12,
  },
  bonusTierValue: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  faqItem: {},
  faqHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  faqAnswer: {
    fontSize: 14,
    lineHeight: 20,
  },
});
