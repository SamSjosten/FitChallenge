// src/lib/__tests__/validation.test.ts
// Comprehensive tests for all Zod validation schemas
//
// These schemas are the input boundary for every write operation.
// A bug here means either:
//   (a) valid user input is rejected (bad UX), or
//   (b) invalid data reaches the database (data corruption / Postgres error)

import {
  usernameSchema,
  emailSchema,
  passwordSchema,
  uuidSchema,
  signUpSchema,
  signInSchema,
  updateProfileSchema,
  challengeTypeSchema,
  winConditionSchema,
  createChallengeSchema,
  logActivitySchema,
  sendFriendRequestSchema,
  acceptFriendRequestSchema,
  declineFriendRequestSchema,
  removeFriendSchema,
  inviteParticipantSchema,
  respondToInviteSchema,
  validate,
  tryValidate,
  ValidationError,
} from "../validation";

// =============================================================================
// TEST HELPERS
// =============================================================================

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const ANOTHER_UUID = "660e8400-e29b-41d4-a716-446655440000";

/** Fixed base dates — no dependency on Date.now() */
const FIXED_START = "2025-06-01T12:00:00.000Z";

/** ISO string N days after FIXED_START */
function fixedPlusDays(n: number): string {
  const d = new Date(FIXED_START);
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

/** Minimal valid challenge input using fixed dates */
function validChallenge(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: "10K Steps Challenge",
    challenge_type: "steps",
    goal_value: 10000,
    goal_unit: "steps",
    start_date: FIXED_START,
    end_date: fixedPlusDays(7),
    ...overrides,
  };
}

// =============================================================================
// PRIMITIVE SCHEMAS
// =============================================================================

describe("usernameSchema", () => {
  test("accepts valid username", () => {
    expect(usernameSchema.parse("john_doe")).toBe("john_doe");
  });

  test("transforms to lowercase", () => {
    expect(usernameSchema.parse("JohnDoe")).toBe("johndoe");
    expect(usernameSchema.parse("ALLCAPS")).toBe("allcaps");
  });

  test("accepts minimum length (3)", () => {
    expect(usernameSchema.parse("abc")).toBe("abc");
  });

  test("accepts maximum length (20)", () => {
    expect(usernameSchema.parse("a".repeat(20))).toBe("a".repeat(20));
  });

  test("rejects too short (2 chars)", () => {
    expect(() => usernameSchema.parse("ab")).toThrow();
  });

  test("rejects too long (21 chars)", () => {
    expect(() => usernameSchema.parse("a".repeat(21))).toThrow();
  });

  test("rejects empty string", () => {
    expect(() => usernameSchema.parse("")).toThrow();
  });

  test("accepts numbers and underscores", () => {
    expect(usernameSchema.parse("user_123")).toBe("user_123");
  });

  test("rejects spaces", () => {
    expect(() => usernameSchema.parse("john doe")).toThrow();
  });

  test("rejects special characters", () => {
    expect(() => usernameSchema.parse("john@doe")).toThrow();
    expect(() => usernameSchema.parse("john-doe")).toThrow();
    expect(() => usernameSchema.parse("john.doe")).toThrow();
    expect(() => usernameSchema.parse("john!")).toThrow();
  });

  test("rejects non-string input", () => {
    expect(() => usernameSchema.parse(123)).toThrow();
    expect(() => usernameSchema.parse(null)).toThrow();
    expect(() => usernameSchema.parse(undefined)).toThrow();
  });
});

describe("emailSchema", () => {
  test("accepts valid email", () => {
    expect(emailSchema.parse("test@example.com")).toBe("test@example.com");
  });

  test("transforms to lowercase", () => {
    expect(emailSchema.parse("Test@Example.COM")).toBe("test@example.com");
  });

  test("trims whitespace before validation", () => {
    expect(emailSchema.parse("  test@example.com  ")).toBe("test@example.com");
  });

  test("applies both trim and lowercase", () => {
    expect(emailSchema.parse("  TEST@EXAMPLE.COM  ")).toBe("test@example.com");
  });

  test("rejects invalid email format", () => {
    expect(() => emailSchema.parse("not-an-email")).toThrow();
    expect(() => emailSchema.parse("@example.com")).toThrow();
    expect(() => emailSchema.parse("test@")).toThrow();
    expect(() => emailSchema.parse("test@.com")).toThrow();
  });

  test("rejects empty string", () => {
    expect(() => emailSchema.parse("")).toThrow();
  });

  test("rejects non-string input", () => {
    expect(() => emailSchema.parse(123)).toThrow();
    expect(() => emailSchema.parse(null)).toThrow();
  });
});

describe("passwordSchema", () => {
  test("accepts valid password", () => {
    expect(passwordSchema.parse("Password1")).toBe("Password1");
  });

  test("accepts complex password", () => {
    expect(passwordSchema.parse("MyS3cureP@ss!")).toBe("MyS3cureP@ss!");
  });

  test("rejects too short (7 chars)", () => {
    expect(() => passwordSchema.parse("Pass1ab")).toThrow();
  });

  test("accepts minimum length (8 chars)", () => {
    expect(passwordSchema.parse("Passwo1d")).toBe("Passwo1d");
  });

  test("rejects missing uppercase", () => {
    expect(() => passwordSchema.parse("password1")).toThrow();
  });

  test("rejects missing lowercase", () => {
    expect(() => passwordSchema.parse("PASSWORD1")).toThrow();
  });

  test("rejects missing digit", () => {
    expect(() => passwordSchema.parse("Passwordd")).toThrow();
  });

  test("rejects empty string", () => {
    expect(() => passwordSchema.parse("")).toThrow();
  });
});

describe("uuidSchema", () => {
  test("accepts valid UUID v4", () => {
    expect(uuidSchema.parse(VALID_UUID)).toBe(VALID_UUID);
  });

  test("rejects non-UUID strings", () => {
    expect(() => uuidSchema.parse("not-a-uuid")).toThrow();
    expect(() => uuidSchema.parse("12345")).toThrow();
    expect(() => uuidSchema.parse("")).toThrow();
  });

  test("rejects partial UUID", () => {
    expect(() => uuidSchema.parse("550e8400-e29b-41d4")).toThrow();
  });

  test("rejects non-string input", () => {
    expect(() => uuidSchema.parse(123)).toThrow();
    expect(() => uuidSchema.parse(null)).toThrow();
  });
});

// =============================================================================
// AUTH SCHEMAS
// =============================================================================

describe("signUpSchema", () => {
  const validInput = {
    email: "test@example.com",
    password: "Password1",
    username: "testuser",
  };

  test("accepts valid input and applies transforms", () => {
    const result = signUpSchema.parse(validInput);
    expect(result.email).toBe("test@example.com");
    expect(result.password).toBe("Password1");
    expect(result.username).toBe("testuser");
  });

  test("transforms email and username", () => {
    const result = signUpSchema.parse({
      email: "  TEST@Example.COM  ",
      password: "Password1",
      username: "TestUser",
    });
    expect(result.email).toBe("test@example.com");
    expect(result.username).toBe("testuser");
  });

  test("rejects missing fields", () => {
    expect(() => signUpSchema.parse({})).toThrow();
    expect(() => signUpSchema.parse({ email: "a@b.com" })).toThrow();
    expect(() => signUpSchema.parse({ email: "a@b.com", password: "Password1" })).toThrow();
  });

  test("rejects invalid email", () => {
    expect(() => signUpSchema.parse({ ...validInput, email: "bad" })).toThrow();
  });

  test("rejects weak password", () => {
    expect(() => signUpSchema.parse({ ...validInput, password: "weak" })).toThrow();
  });

  test("rejects invalid username", () => {
    expect(() => signUpSchema.parse({ ...validInput, username: "ab" })).toThrow();
  });
});

describe("signInSchema", () => {
  test("accepts valid input", () => {
    const result = signInSchema.parse({
      email: "test@example.com",
      password: "anypassword",
    });
    expect(result.email).toBe("test@example.com");
  });

  test("does NOT enforce password complexity (just non-empty)", () => {
    // signIn only checks password isn't empty — complexity was checked at signUp
    const result = signInSchema.parse({
      email: "test@example.com",
      password: "x",
    });
    expect(result.password).toBe("x");
  });

  test("rejects empty password", () => {
    expect(() => signInSchema.parse({ email: "test@example.com", password: "" })).toThrow();
  });

  test("transforms email to lowercase and trimmed", () => {
    const result = signInSchema.parse({
      email: "  TEST@Example.COM  ",
      password: "pass",
    });
    expect(result.email).toBe("test@example.com");
  });
});

describe("updateProfileSchema", () => {
  test("accepts empty object (all fields optional)", () => {
    const result = updateProfileSchema.parse({});
    expect(result).toEqual({});
  });

  test("accepts valid username", () => {
    const result = updateProfileSchema.parse({ username: "NewName" });
    expect(result.username).toBe("newname");
  });

  test("accepts valid display_name", () => {
    const result = updateProfileSchema.parse({ display_name: "John Doe" });
    expect(result.display_name).toBe("John Doe");
  });

  test("rejects display_name over 50 chars", () => {
    expect(() => updateProfileSchema.parse({ display_name: "a".repeat(51) })).toThrow();
  });

  test("accepts valid avatar_url", () => {
    const result = updateProfileSchema.parse({
      avatar_url: "https://example.com/avatar.png",
    });
    expect(result.avatar_url).toBe("https://example.com/avatar.png");
  });

  test("accepts null avatar_url (for removal)", () => {
    const result = updateProfileSchema.parse({ avatar_url: null });
    expect(result.avatar_url).toBeNull();
  });

  test("rejects invalid avatar_url", () => {
    expect(() => updateProfileSchema.parse({ avatar_url: "not-a-url" })).toThrow();
  });
});

// =============================================================================
// CHALLENGE SCHEMAS
// =============================================================================

describe("challengeTypeSchema", () => {
  test.each(["steps", "active_minutes", "workouts", "distance", "custom"])(
    "accepts '%s'",
    (type) => {
      expect(challengeTypeSchema.parse(type)).toBe(type);
    },
  );

  test("rejects invalid types", () => {
    expect(() => challengeTypeSchema.parse("swimming")).toThrow();
    expect(() => challengeTypeSchema.parse("")).toThrow();
    expect(() => challengeTypeSchema.parse(123)).toThrow();
  });
});

describe("winConditionSchema", () => {
  test.each(["highest_total", "first_to_goal", "longest_streak", "all_complete"])(
    "accepts '%s'",
    (condition) => {
      expect(winConditionSchema.parse(condition)).toBe(condition);
    },
  );

  test("rejects invalid conditions", () => {
    expect(() => winConditionSchema.parse("fastest")).toThrow();
  });
});

describe("createChallengeSchema", () => {
  test("accepts minimal valid input", () => {
    const input = validChallenge();
    const result = createChallengeSchema.parse(input);
    expect(result.title).toBe("10K Steps Challenge");
    expect(result.challenge_type).toBe("steps");
    expect(result.goal_value).toBe(10000);
  });

  test("defaults win_condition to highest_total", () => {
    const result = createChallengeSchema.parse(validChallenge());
    expect(result.win_condition).toBe("highest_total");
  });

  test("defaults is_solo to false", () => {
    const result = createChallengeSchema.parse(validChallenge());
    expect(result.is_solo).toBe(false);
  });

  test("accepts is_solo = true", () => {
    const result = createChallengeSchema.parse(validChallenge({ is_solo: true }));
    expect(result.is_solo).toBe(true);
  });

  test("accepts all optional fields", () => {
    const result = createChallengeSchema.parse(
      validChallenge({
        description: "A fitness challenge",
        win_condition: "first_to_goal",
        daily_target: 1000,
        allowed_workout_types: ["running", "cycling"],
      }),
    );
    expect(result.description).toBe("A fitness challenge");
    expect(result.win_condition).toBe("first_to_goal");
    expect(result.daily_target).toBe(1000);
    expect(result.allowed_workout_types).toEqual(["running", "cycling"]);
  });

  // Title validation
  test("rejects title too short (2 chars)", () => {
    expect(() => createChallengeSchema.parse(validChallenge({ title: "ab" }))).toThrow();
  });

  test("accepts title at minimum (3 chars)", () => {
    const result = createChallengeSchema.parse(validChallenge({ title: "abc" }));
    expect(result.title).toBe("abc");
  });

  test("rejects title too long (101 chars)", () => {
    expect(() => createChallengeSchema.parse(validChallenge({ title: "a".repeat(101) }))).toThrow();
  });

  test("rejects description too long (501 chars)", () => {
    expect(() =>
      createChallengeSchema.parse(validChallenge({ description: "a".repeat(501) })),
    ).toThrow();
  });

  // Goal validation
  test("rejects zero goal_value", () => {
    expect(() => createChallengeSchema.parse(validChallenge({ goal_value: 0 }))).toThrow();
  });

  test("rejects negative goal_value", () => {
    expect(() => createChallengeSchema.parse(validChallenge({ goal_value: -100 }))).toThrow();
  });

  test("rejects non-integer goal_value", () => {
    expect(() => createChallengeSchema.parse(validChallenge({ goal_value: 99.5 }))).toThrow();
  });

  test("rejects goal_value over 10M", () => {
    expect(() => createChallengeSchema.parse(validChallenge({ goal_value: 10000001 }))).toThrow();
  });

  test("accepts goal_value at max (10M)", () => {
    const result = createChallengeSchema.parse(validChallenge({ goal_value: 10000000 }));
    expect(result.goal_value).toBe(10000000);
  });

  // Date validation
  test("rejects end_date before start_date", () => {
    expect(() =>
      createChallengeSchema.parse(
        validChallenge({
          start_date: fixedPlusDays(5),
          end_date: fixedPlusDays(3),
        }),
      ),
    ).toThrow();
  });

  test("rejects end_date equal to start_date", () => {
    expect(() =>
      createChallengeSchema.parse(
        validChallenge({ start_date: FIXED_START, end_date: FIXED_START }),
      ),
    ).toThrow();
  });

  test("rejects duration under 1 day", () => {
    // 12 hours after start — less than 1 day
    const halfDayLater = "2025-06-02T00:00:00.000Z";
    expect(() =>
      createChallengeSchema.parse(
        validChallenge({
          start_date: FIXED_START,
          end_date: halfDayLater,
        }),
      ),
    ).toThrow();
  });

  test("rejects duration over 365 days", () => {
    expect(() =>
      createChallengeSchema.parse(
        validChallenge({
          start_date: FIXED_START,
          end_date: fixedPlusDays(367),
        }),
      ),
    ).toThrow();
  });

  test("accepts duration of exactly 1 day", () => {
    const result = createChallengeSchema.parse(
      validChallenge({
        start_date: FIXED_START,
        end_date: fixedPlusDays(1),
      }),
    );
    expect(result.start_date).toBe(FIXED_START);
  });

  test("accepts duration of exactly 365 days", () => {
    const result = createChallengeSchema.parse(
      validChallenge({
        start_date: FIXED_START,
        end_date: fixedPlusDays(365),
      }),
    );
    expect(result).toBeDefined();
  });

  // Custom activity name
  test("requires custom_activity_name for custom type", () => {
    expect(() =>
      createChallengeSchema.parse(
        validChallenge({
          challenge_type: "custom",
          goal_unit: "reps",
        }),
      ),
    ).toThrow();
  });

  test("accepts custom type with valid activity name", () => {
    const result = createChallengeSchema.parse(
      validChallenge({
        challenge_type: "custom",
        custom_activity_name: "Burpees",
        goal_unit: "reps",
      }),
    );
    expect(result.custom_activity_name).toBe("Burpees");
  });

  test("rejects custom type with too-short activity name", () => {
    expect(() =>
      createChallengeSchema.parse(
        validChallenge({
          challenge_type: "custom",
          custom_activity_name: "X",
          goal_unit: "reps",
        }),
      ),
    ).toThrow();
  });

  test("does not require custom_activity_name for non-custom types", () => {
    const result = createChallengeSchema.parse(validChallenge());
    expect(result.custom_activity_name).toBeUndefined();
  });

  // Invalid date format
  test("rejects non-ISO date strings", () => {
    expect(() =>
      createChallengeSchema.parse(validChallenge({ start_date: "next tuesday" })),
    ).toThrow();
  });
});

// =============================================================================
// ACTIVITY SCHEMAS
// =============================================================================

describe("logActivitySchema", () => {
  const validInput = {
    challenge_id: VALID_UUID,
    activity_type: "steps",
    value: 5000,
    client_event_id: ANOTHER_UUID,
  };

  test("accepts valid input", () => {
    const result = logActivitySchema.parse(validInput);
    expect(result.value).toBe(5000);
    expect(result.activity_type).toBe("steps");
  });

  test("accepts optional recorded_at", () => {
    const result = logActivitySchema.parse({
      ...validInput,
      recorded_at: new Date().toISOString(),
    });
    expect(result.recorded_at).toBeDefined();
  });

  test("rejects zero value", () => {
    expect(() => logActivitySchema.parse({ ...validInput, value: 0 })).toThrow();
  });

  test("rejects negative value", () => {
    expect(() => logActivitySchema.parse({ ...validInput, value: -100 })).toThrow();
  });

  test("rejects non-integer value", () => {
    expect(() => logActivitySchema.parse({ ...validInput, value: 3.5 })).toThrow();
  });

  test("rejects value over 1M", () => {
    expect(() => logActivitySchema.parse({ ...validInput, value: 1000001 })).toThrow();
  });

  test("accepts value at max (1M)", () => {
    const result = logActivitySchema.parse({ ...validInput, value: 1000000 });
    expect(result.value).toBe(1000000);
  });

  test("rejects invalid challenge_id", () => {
    expect(() => logActivitySchema.parse({ ...validInput, challenge_id: "bad" })).toThrow();
  });

  test("rejects invalid client_event_id", () => {
    expect(() => logActivitySchema.parse({ ...validInput, client_event_id: "bad" })).toThrow();
  });

  test("rejects missing client_event_id", () => {
    const { client_event_id, ...missing } = validInput;
    expect(() => logActivitySchema.parse(missing)).toThrow();
  });

  test("rejects invalid activity_type", () => {
    expect(() => logActivitySchema.parse({ ...validInput, activity_type: "swimming" })).toThrow();
  });
});

// =============================================================================
// FRIENDS SCHEMAS
// =============================================================================

describe("sendFriendRequestSchema", () => {
  test("accepts valid UUID", () => {
    const result = sendFriendRequestSchema.parse({
      target_user_id: VALID_UUID,
    });
    expect(result.target_user_id).toBe(VALID_UUID);
  });

  test("rejects invalid UUID", () => {
    expect(() => sendFriendRequestSchema.parse({ target_user_id: "not-uuid" })).toThrow();
  });

  test("rejects missing field", () => {
    expect(() => sendFriendRequestSchema.parse({})).toThrow();
  });
});

describe("acceptFriendRequestSchema", () => {
  test("accepts valid UUID", () => {
    const result = acceptFriendRequestSchema.parse({
      friendship_id: VALID_UUID,
    });
    expect(result.friendship_id).toBe(VALID_UUID);
  });

  test("rejects invalid UUID", () => {
    expect(() => acceptFriendRequestSchema.parse({ friendship_id: "bad" })).toThrow();
  });
});

describe("declineFriendRequestSchema", () => {
  test("accepts valid UUID", () => {
    const result = declineFriendRequestSchema.parse({
      friendship_id: VALID_UUID,
    });
    expect(result.friendship_id).toBe(VALID_UUID);
  });

  test("rejects invalid UUID", () => {
    expect(() => declineFriendRequestSchema.parse({ friendship_id: 123 })).toThrow();
  });
});

describe("removeFriendSchema", () => {
  test("accepts valid UUID", () => {
    const result = removeFriendSchema.parse({ friendship_id: VALID_UUID });
    expect(result.friendship_id).toBe(VALID_UUID);
  });

  test("rejects invalid UUID", () => {
    expect(() => removeFriendSchema.parse({ friendship_id: null })).toThrow();
  });
});

// =============================================================================
// INVITE SCHEMAS
// =============================================================================

describe("inviteParticipantSchema", () => {
  test("accepts valid input", () => {
    const result = inviteParticipantSchema.parse({
      challenge_id: VALID_UUID,
      user_id: ANOTHER_UUID,
    });
    expect(result.challenge_id).toBe(VALID_UUID);
    expect(result.user_id).toBe(ANOTHER_UUID);
  });

  test("rejects invalid challenge_id", () => {
    expect(() =>
      inviteParticipantSchema.parse({
        challenge_id: "bad",
        user_id: ANOTHER_UUID,
      }),
    ).toThrow();
  });

  test("rejects invalid user_id", () => {
    expect(() =>
      inviteParticipantSchema.parse({
        challenge_id: VALID_UUID,
        user_id: "bad",
      }),
    ).toThrow();
  });

  test("rejects missing fields", () => {
    expect(() => inviteParticipantSchema.parse({})).toThrow();
    expect(() => inviteParticipantSchema.parse({ challenge_id: VALID_UUID })).toThrow();
  });
});

describe("respondToInviteSchema", () => {
  test("accepts 'accepted' response", () => {
    const result = respondToInviteSchema.parse({
      challenge_id: VALID_UUID,
      response: "accepted",
    });
    expect(result.response).toBe("accepted");
  });

  test("accepts 'declined' response", () => {
    const result = respondToInviteSchema.parse({
      challenge_id: VALID_UUID,
      response: "declined",
    });
    expect(result.response).toBe("declined");
  });

  test("rejects invalid response values", () => {
    expect(() =>
      respondToInviteSchema.parse({
        challenge_id: VALID_UUID,
        response: "maybe",
      }),
    ).toThrow();
  });

  test("rejects invalid challenge_id", () => {
    expect(() =>
      respondToInviteSchema.parse({
        challenge_id: "bad",
        response: "accepted",
      }),
    ).toThrow();
  });
});

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

describe("validate()", () => {
  test("returns parsed data on success", () => {
    const result = validate(usernameSchema, "TestUser");
    expect(result).toBe("testuser");
  });

  test("throws ValidationError on failure", () => {
    expect(() => validate(usernameSchema, "ab")).toThrow(ValidationError);
  });

  test("ValidationError contains field-level errors", () => {
    try {
      validate(signUpSchema, { email: "bad", password: "x", username: "a" });
      fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      const ve = e as ValidationError;
      expect(ve.errors.length).toBeGreaterThan(0);
      // Each error has field and message
      ve.errors.forEach((err) => {
        expect(err).toHaveProperty("field");
        expect(err).toHaveProperty("message");
        expect(typeof err.message).toBe("string");
      });
    }
  });

  test("ValidationError.firstError returns first message", () => {
    try {
      validate(usernameSchema, "ab");
      fail("Should have thrown");
    } catch (e) {
      const ve = e as ValidationError;
      expect(typeof ve.firstError).toBe("string");
      expect(ve.firstError.length).toBeGreaterThan(0);
    }
  });

  test("ValidationError.getFieldError returns error for specific field", () => {
    try {
      validate(signUpSchema, {
        email: "bad",
        password: "Password1",
        username: "testuser",
      });
      fail("Should have thrown");
    } catch (e) {
      const ve = e as ValidationError;
      expect(ve.getFieldError("email")).toBeDefined();
      expect(ve.getFieldError("nonexistent")).toBeUndefined();
    }
  });

  test("ValidationError.name is 'ValidationError'", () => {
    try {
      validate(usernameSchema, "");
      fail("Should have thrown");
    } catch (e) {
      expect((e as Error).name).toBe("ValidationError");
    }
  });
});

describe("tryValidate()", () => {
  test("returns parsed data on success", () => {
    const result = tryValidate(usernameSchema, "TestUser");
    expect(result).toBe("testuser");
  });

  test("returns null on failure (no throw)", () => {
    const result = tryValidate(usernameSchema, "ab");
    expect(result).toBeNull();
  });

  test("returns null for completely wrong types", () => {
    expect(tryValidate(usernameSchema, 123)).toBeNull();
    expect(tryValidate(usernameSchema, null)).toBeNull();
    expect(tryValidate(usernameSchema, undefined)).toBeNull();
  });
});

// =============================================================================
// EDGE CASES: Type coercion safety
// =============================================================================

describe("type coercion safety", () => {
  test("number schema rejects string numbers", () => {
    expect(() =>
      logActivitySchema.parse({
        challenge_id: VALID_UUID,
        activity_type: "steps",
        value: "5000", // string, not number
        client_event_id: ANOTHER_UUID,
      }),
    ).toThrow();
  });

  test("string schema rejects numbers", () => {
    expect(() => usernameSchema.parse(12345)).toThrow();
  });

  test("object schemas reject arrays", () => {
    expect(() => signInSchema.parse([1, 2, 3])).toThrow();
  });

  test("object schemas reject null", () => {
    expect(() => signUpSchema.parse(null)).toThrow();
  });

  test("object schemas reject undefined", () => {
    expect(() => signUpSchema.parse(undefined)).toThrow();
  });
});
