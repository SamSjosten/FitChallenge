// src/__tests__/integration/auth.lifecycle.integration.test.ts
// Integration tests for authentication lifecycle

import {
  validateTestConfig,
  createEphemeralUser,
  deleteEphemeralUser,
  createServiceClient,
} from "./setup";

beforeAll(() => {
  validateTestConfig();
});

describe("Auth lifecycle", () => {
  let userId: string;
  let email: string;
  let password: string;
  let client: Awaited<ReturnType<typeof createEphemeralUser>>["client"];

  beforeAll(async () => {
    const user = await createEphemeralUser("lifecycle");
    userId = user.id;
    email = user.email;
    password = user.password;
    client = user.client;
  });

  afterAll(async () => {
    if (userId) {
      await deleteEphemeralUser(userId);
    }
  });

  it("signup creates session and profile", async () => {
    // Verify session exists
    const { data: userData } = await client.auth.getUser();
    expect(userData.user).not.toBeNull();
    expect(userData.user?.id).toBe(userId);

    // Verify profile exists via service client
    const serviceClient = createServiceClient();
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    expect(profile).not.toBeNull();
    expect(profile?.id).toBe(userId);
  });

  it("login restores valid session", async () => {
    // Sign out first
    await client.auth.signOut();

    // Sign back in with credentials
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    expect(error).toBeNull();
    expect(data.session).not.toBeNull();
    expect(data.user?.id).toBe(userId);
  });

  it("logout clears session", async () => {
    await client.auth.signOut();

    const { data: userData } = await client.auth.getUser();
    expect(userData.user).toBeNull();
  });

  it("auth-required service call fails after sign-out", async () => {
    // Ensure signed out
    await client.auth.signOut();

    const { error } = await client.rpc("create_challenge_with_participant", {
      p_title: "Should Fail",
      p_challenge_type: "steps",
      p_goal_value: 10000,
      p_goal_unit: "steps",
      p_start_date: new Date().toISOString(),
      p_end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    expect(error).not.toBeNull();
    // Error message varies by Supabase version — accept any auth-related error
    if (error?.message) {
      expect(error.message).toMatch(/auth|session|PGRST30[12]/i);
    }
  });
});
