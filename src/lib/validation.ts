// src/lib/validation.ts
// Input validation schemas using Zod

import { z } from "zod";

// =============================================================================
// PRIMITIVE SCHEMAS
// =============================================================================

export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be 20 characters or less")
  .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, and underscores only")
  .transform((v) => v.toLowerCase());

export const emailSchema = z
  .string()
  .email("Invalid email address")
  .transform((v) => v.toLowerCase().trim());

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/[a-z]/, "Must contain a lowercase letter")
  .regex(/[0-9]/, "Must contain a number");

export const uuidSchema = z.string().uuid("Invalid ID format");

// =============================================================================
// AUTH SCHEMAS
// =============================================================================

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  username: usernameSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const updateProfileSchema = z.object({
  username: usernameSchema.optional(),
  display_name: z.string().max(50, "Display name too long").optional(),
  avatar_url: z.string().url("Invalid avatar URL").optional().nullable(),
});

// =============================================================================
// CHALLENGE SCHEMAS
// =============================================================================

export const challengeTypeSchema = z.enum([
  "steps",
  "active_minutes",
  "workouts",
  "distance",
  "custom",
]);

export const winConditionSchema = z.enum([
  "highest_total",
  "first_to_goal",
  "longest_streak",
  "all_complete",
]);

export const createChallengeSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters").max(100, "Title too long"),
    description: z.string().max(500, "Description too long").optional(),
    challenge_type: challengeTypeSchema,
    custom_activity_name: z
      .string()
      .min(2, "Activity name must be at least 2 characters")
      .max(50, "Activity name too long")
      .optional(),
    goal_value: z
      .number()
      .int("Must be a whole number")
      .positive("Must be positive")
      .max(10000000, "Goal too large"),
    goal_unit: z.string().min(1).max(20, "Unit too long"),
    win_condition: winConditionSchema.default("highest_total"),
    daily_target: z.number().int().positive().optional(),
    start_date: z.string().datetime({ message: "Invalid start date" }),
    end_date: z.string().datetime({ message: "Invalid end date" }),
    // Workout points (migration 034)
    allowed_workout_types: z.array(z.string()).optional(),
    // Solo challenge flag (migration 035)
    is_solo: z.boolean().default(false),
  })
  .refine(
    (d) =>
      d.challenge_type !== "custom" ||
      (d.custom_activity_name && d.custom_activity_name.trim().length >= 2),
    {
      message: "Custom activity name is required for custom challenges",
      path: ["custom_activity_name"],
    },
  )
  .refine((d) => new Date(d.end_date) > new Date(d.start_date), {
    message: "End date must be after start date",
    path: ["end_date"],
  })
  .refine(
    (d) => {
      const days = (new Date(d.end_date).getTime() - new Date(d.start_date).getTime()) / 86400000;
      return days >= 1 && days <= 365;
    },
    { message: "Duration must be 1-365 days", path: ["end_date"] },
  );

// =============================================================================
// ACTIVITY SCHEMAS
// =============================================================================

export const logActivitySchema = z.object({
  challenge_id: uuidSchema,
  activity_type: challengeTypeSchema,
  value: z
    .number()
    .int("Must be a whole number")
    .positive("Must be positive")
    .max(1000000, "Value too large"),
  client_event_id: uuidSchema,
  recorded_at: z.string().datetime().optional(),
});

// =============================================================================
// FRIENDS SCHEMAS
// =============================================================================

export const sendFriendRequestSchema = z.object({
  target_user_id: uuidSchema,
});

export const acceptFriendRequestSchema = z.object({
  friendship_id: uuidSchema,
});

export const declineFriendRequestSchema = z.object({
  friendship_id: uuidSchema,
});

export const removeFriendSchema = z.object({
  friendship_id: uuidSchema,
});

// =============================================================================
// INVITE SCHEMAS
// =============================================================================

export const inviteParticipantSchema = z.object({
  challenge_id: uuidSchema,
  user_id: uuidSchema,
});

export const respondToInviteSchema = z.object({
  challenge_id: uuidSchema,
  response: z.enum(["accepted", "declined"]),
});

// =============================================================================
// VALIDATION ERROR CLASS
// =============================================================================

export class ValidationError extends Error {
  constructor(public errors: Array<{ field: string; message: string }>) {
    super("Validation failed");
    this.name = "ValidationError";
  }

  get firstError(): string {
    return this.errors[0]?.message || "Validation failed";
  }

  getFieldError(field: string): string | undefined {
    return this.errors.find((e) => e.field === field)?.message;
  }
}

/**
 * Validate data against a Zod schema
 * Throws ValidationError with field-level errors if validation fails
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    );
  }
  return result.data;
}

/**
 * Try to validate, returning null on failure instead of throwing
 */
export function tryValidate<T>(schema: z.ZodSchema<T>, data: unknown): T | null {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;
export type LogActivityInput = z.infer<typeof logActivitySchema>;
export type SendFriendRequestInput = z.infer<typeof sendFriendRequestSchema>;
export type AcceptFriendRequestInput = z.infer<typeof acceptFriendRequestSchema>;
export type DeclineFriendRequestInput = z.infer<typeof declineFriendRequestSchema>;
export type RemoveFriendInput = z.infer<typeof removeFriendSchema>;
export type InviteParticipantInput = z.infer<typeof inviteParticipantSchema>;
export type RespondToInviteInput = z.infer<typeof respondToInviteSchema>;
