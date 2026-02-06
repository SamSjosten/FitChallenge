// src/components/v2/create/CreateChallengeOrchestrator.tsx
// Orchestrates the multi-step challenge creation flow.
//
// Navigation:  mode → type → [workoutPicker] → details → [invite] → review → success
// Conditional: workoutPicker only for 'workouts' type (uses migration 034 workout_type_catalog)
//              invite only for 'social' mode

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/providers/ThemeProvider";
import { ChevronLeftIcon } from "react-native-heroicons/outline";
import { useRouter } from "expo-router";
import { useCreateChallenge, useInviteUser } from "@/hooks/useChallenges";
import { useFriends } from "@/hooks/useFriends";
import { getServerNow } from "@/lib/serverTime";
import { pushTokenService } from "@/services/pushTokens";
import type { ChallengeType } from "@/types/database";

import { StepProgress } from "./StepProgress";
import { StepMode } from "./StepMode";
import { StepType } from "./StepType";
import { StepWorkoutPicker } from "./StepWorkoutPicker";
import { StepDetails } from "./StepDetails";
import { StepInvite } from "./StepInvite";
import { StepReview } from "./StepReview";
import { StepSuccess } from "./StepSuccess";
import {
  type CreateStep,
  type ChallengeMode,
  type CreateFormData,
  INITIAL_FORM_DATA,
  DURATION_PRESETS,
  CHALLENGE_TYPES,
} from "./types";

function getVisibleSteps(
  mode: ChallengeMode | null,
  challengeType: ChallengeType | null,
): CreateStep[] {
  const steps: CreateStep[] = ["mode", "type"];
  if (challengeType === "workouts") {
    steps.push("workoutPicker");
  }
  steps.push("details");
  if (mode === "social") {
    steps.push("invite");
  }
  steps.push("review");
  return steps;
}

// Header titles per step
function getStepTitle(step: CreateStep, mode: ChallengeMode | null): string {
  switch (step) {
    case "mode":
      return "New Challenge";
    case "type":
      return "Activity Type";
    case "workoutPicker":
      return "Workout Types";
    case "details":
      return mode === "solo" ? "Goal Details" : "Challenge Details";
    case "invite":
      return "Invite Friends";
    case "review":
      return "Review";
    case "success":
      return "";
    default:
      return "New Challenge";
  }
}

// CTA label per step
function getCtaLabel(
  step: CreateStep,
  mode: ChallengeMode | null,
  selectedCount: number,
): string | null {
  switch (step) {
    case "workoutPicker":
      return "Continue";
    case "details":
      return "Continue";
    case "invite":
      return selectedCount > 0
        ? `Continue with ${selectedCount} friend${selectedCount !== 1 ? "s" : ""}`
        : "Skip — invite later";
    case "review":
      return mode === "solo" ? "Start Goal" : "Create Challenge";
    default:
      return null; // mode, type, success don't have sticky CTAs
  }
}

export function CreateChallengeOrchestrator() {
  const { colors, radius } = useAppTheme();
  const router = useRouter();

  // ─── Data hooks ───
  const createChallenge = useCreateChallenge();
  const inviteUser = useInviteUser();
  const { data: friends = [], isLoading: friendsLoading } = useFriends();

  // ─── Flow state ───
  const [currentStep, setCurrentStep] = useState<CreateStep>("mode");
  const [mode, setMode] = useState<ChallengeMode | null>(null);
  const [challengeType, setChallengeType] = useState<ChallengeType | null>(
    null,
  );
  const [formData, setFormData] = useState<CreateFormData>(INITIAL_FORM_DATA);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Navigation handlers ───

  const handleClose = useCallback(() => {
    if (currentStep === "mode") {
      router.back();
      return;
    }
    Alert.alert("Discard Challenge?", "Your progress will be lost.", [
      { text: "Keep Editing", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => router.back(),
      },
    ]);
  }, [currentStep, router]);

  const handleBack = useCallback(() => {
    switch (currentStep) {
      case "type":
        setCurrentStep("mode");
        break;
      case "workoutPicker":
        setCurrentStep("type");
        break;
      case "details":
        setCurrentStep(challengeType === "workouts" ? "workoutPicker" : "type");
        break;
      case "invite":
        setCurrentStep("details");
        break;
      case "review":
        setCurrentStep(mode === "social" ? "invite" : "details");
        break;
      default:
        setCurrentStep("mode");
    }
  }, [currentStep, mode, challengeType]);

  const handleModeSelect = useCallback((m: ChallengeMode) => {
    setMode(m);
    setCurrentStep("type");
  }, []);

  const handleTypeSelect = useCallback((t: ChallengeType) => {
    setChallengeType(t);
    if (t === "workouts") {
      setCurrentStep("workoutPicker");
    } else {
      setCurrentStep("details");
    }
  }, []);

  const handleWorkoutPickerNext = useCallback(() => {
    setCurrentStep("details");
  }, []);

  const handleDetailsNext = useCallback(() => {
    if (mode === "social") {
      setCurrentStep("invite");
    } else {
      setCurrentStep("review");
    }
  }, [mode]);

  const handleInviteNext = useCallback(() => {
    setCurrentStep("review");
  }, []);

  // ─── Submit ───

  const handleCreate = useCallback(async () => {
    if (!challengeType || !mode) return;
    setIsSubmitting(true);

    try {
      // Compute dates using server-authoritative time
      const durationDays =
        formData.durationPreset === "custom"
          ? parseInt(formData.customDurationDays, 10) || 7
          : (DURATION_PRESETS.find((d) => d.id === formData.durationPreset)
              ?.days ?? 7);

      const now = getServerNow();

      // Start date: "now" uses server time + 1 min buffer; "scheduled" uses user pick
      let startDate: Date;
      if (formData.startMode === "scheduled") {
        startDate = formData.scheduledStart;
        // Validate scheduled start is in the future
        if (startDate <= now) {
          Alert.alert(
            "Invalid Start Date",
            "Scheduled start must be in the future.",
          );
          setIsSubmitting(false);
          return;
        }
      } else {
        startDate = new Date(now.getTime() + 60000); // +1 minute buffer
      }

      const endDate = new Date(startDate.getTime());
      endDate.setDate(endDate.getDate() + durationDays);

      const typeConfig = CHALLENGE_TYPES.find((t) => t.id === challengeType);

      const goalUnit =
        challengeType === "custom" && formData.customUnit
          ? formData.customUnit.trim()
          : (typeConfig?.unit ?? challengeType);

      // Parse optional daily target
      const dailyTarget = parseInt(formData.dailyTarget, 10);

      const result = await createChallenge.mutateAsync({
        title: formData.name.trim(),
        description: formData.description.trim() || undefined,
        challenge_type: challengeType,
        // For custom challenges, customUnit serves as both activity name and unit
        ...(challengeType === "custom" && formData.customUnit
          ? { custom_activity_name: formData.customUnit.trim() }
          : {}),
        goal_value: parseInt(formData.goal, 10) || 0,
        goal_unit: goalUnit,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        win_condition: formData.winCondition,
        ...(dailyTarget > 0 ? { daily_target: dailyTarget } : {}),
        // For workout challenges: pass selected types (empty = all allowed)
        ...(challengeType === "workouts" &&
        formData.selectedWorkoutTypes.length > 0
          ? { allowed_workout_types: formData.selectedWorkoutTypes }
          : {}),
      });

      // Send invites (best-effort, don't block success)
      if (mode === "social" && selectedFriendIds.length > 0 && result?.id) {
        await Promise.allSettled(
          selectedFriendIds.map((friendId) =>
            inviteUser.mutateAsync({
              challenge_id: result.id,
              user_id: friendId,
            }),
          ),
        );
      }

      // Request notification permission contextually (non-blocking)
      // User just created a challenge — they'll want updates about participants
      pushTokenService
        .requestAndRegister()
        .catch((err) => console.warn("Push notification setup failed:", err));

      setCurrentStep("success");
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to create challenge",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    challengeType,
    mode,
    formData,
    selectedFriendIds,
    createChallenge,
    inviteUser,
  ]);

  const handleDone = useCallback(() => {
    router.back();
  }, [router]);

  // ─── Validation for CTA ───

  const isCtaDisabled = (() => {
    switch (currentStep) {
      case "details": {
        const nameEmpty = formData.name.trim().length === 0;
        const goalEmpty =
          formData.goal.trim().length === 0 || parseInt(formData.goal, 10) <= 0;
        // Custom challenges require the "what are you tracking?" field
        const customMissing =
          challengeType === "custom" && formData.customUnit.trim().length < 2;
        return nameEmpty || goalEmpty || customMissing;
      }
      case "review":
        return isSubmitting;
      default:
        return false;
    }
  })();

  // ─── CTA handler ───

  const handleCtaPress = useCallback(() => {
    switch (currentStep) {
      case "workoutPicker":
        handleWorkoutPickerNext();
        break;
      case "details":
        handleDetailsNext();
        break;
      case "invite":
        handleInviteNext();
        break;
      case "review":
        handleCreate();
        break;
    }
  }, [
    currentStep,
    handleWorkoutPickerNext,
    handleDetailsNext,
    handleInviteNext,
    handleCreate,
  ]);

  // ─── Render ───

  // Success is full-screen, no header/footer
  if (currentStep === "success") {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
      >
        <StepSuccess
          mode={mode || "social"}
          challengeName={formData.name}
          inviteCount={selectedFriendIds.length}
          onDone={handleDone}
        />
      </SafeAreaView>
    );
  }

  const visibleSteps = getVisibleSteps(mode, challengeType);
  const stepIndex = visibleSteps.indexOf(currentStep);
  const title = getStepTitle(currentStep, mode);
  const ctaLabel = getCtaLabel(currentStep, mode, selectedFriendIds.length);

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={currentStep === "mode" ? handleClose : handleBack}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.backBtn}
            >
              <ChevronLeftIcon size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {title}
            </Text>
            {/* Spacer for centering */}
            <View style={styles.backBtn} />
          </View>
          {stepIndex >= 0 && (
            <StepProgress
              currentStep={stepIndex}
              totalSteps={visibleSteps.length}
            />
          )}
        </View>

        {/* Step Content */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {currentStep === "mode" && (
            <StepMode onSelect={handleModeSelect} onClose={handleClose} />
          )}
          {currentStep === "type" && mode && (
            <StepType
              mode={mode}
              onSelect={handleTypeSelect}
              onBack={handleBack}
            />
          )}
          {currentStep === "workoutPicker" && (
            <StepWorkoutPicker
              selectedWorkoutTypes={formData.selectedWorkoutTypes}
              setSelectedWorkoutTypes={(types) =>
                setFormData({ ...formData, selectedWorkoutTypes: types })
              }
              onNext={handleWorkoutPickerNext}
              onBack={handleBack}
            />
          )}
          {currentStep === "details" && mode && challengeType && (
            <StepDetails
              mode={mode}
              challengeType={challengeType}
              formData={formData}
              setFormData={setFormData}
              onNext={handleDetailsNext}
              onBack={handleBack}
            />
          )}
          {currentStep === "invite" && (
            <StepInvite
              friends={friends}
              friendsLoading={friendsLoading}
              selectedFriendIds={selectedFriendIds}
              setSelectedFriendIds={setSelectedFriendIds}
              onNext={handleInviteNext}
              onBack={handleBack}
            />
          )}
          {currentStep === "review" && mode && challengeType && (
            <StepReview
              mode={mode}
              challengeType={challengeType}
              formData={formData}
              friends={friends}
              selectedFriendIds={selectedFriendIds}
              onBack={handleBack}
            />
          )}
        </ScrollView>

        {/* Sticky CTA */}
        {ctaLabel && (
          <View
            style={[
              styles.footer,
              {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
              },
            ]}
          >
            <TouchableOpacity
              onPress={handleCtaPress}
              disabled={isCtaDisabled}
              activeOpacity={0.8}
              style={[
                styles.ctaButton,
                {
                  backgroundColor: isCtaDisabled
                    ? colors.textMuted
                    : colors.primary.main,
                  borderRadius: radius.xl,
                },
              ]}
            >
              {isSubmitting ? (
                <Text
                  style={[styles.ctaText, { color: colors.primary.contrast }]}
                >
                  Creating...
                </Text>
              ) : (
                <Text
                  style={[styles.ctaText, { color: colors.primary.contrast }]}
                >
                  {ctaLabel}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 8,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 32,
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  scrollContent: {
    paddingBottom: 24,
    paddingTop: 8,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  ctaButton: {
    paddingVertical: 16,
    alignItems: "center",
  },
  ctaText: {
    fontSize: 18,
    fontWeight: "600",
  },
});
