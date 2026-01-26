import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Missing required environment variables:");
  console.error("   SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
  console.error("   SUPABASE_SERVICE_ROLE_KEY:", serviceRoleKey ? "✓" : "✗");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Dedicated E2E test users with known credentials
const testUsers = [
  {
    email: "e2e-primary@test.local",
    password: "E2eTestPassword123!",
    userData: { display_name: "E2E Primary User" },
  },
  {
    email: "e2e-secondary@test.local",
    password: "E2eTestPassword123!",
    userData: { display_name: "E2E Secondary User" },
  },
  {
    email: "e2e-friend@test.local",
    password: "E2eTestPassword123!",
    userData: { display_name: "E2E Friend User" },
  },
];

async function seedUsers() {
  console.log("🌱 Seeding E2E test users...\n");

  for (const user of testUsers) {
    try {
      // Try to create the user
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: user.userData,
      });

      if (error) {
        // User already exists - that's fine
        if (
          error.message.includes("already") ||
          error.message.includes("exists")
        ) {
          console.log(`✓ Already exists: ${user.email}`);
        } else {
          console.error(`✗ Failed to create ${user.email}: ${error.message}`);
        }
      } else {
        console.log(`✓ Created: ${user.email} (id: ${data.user?.id})`);
      }
    } catch (err) {
      console.error(`✗ Error creating ${user.email}:`, err);
    }
  }

  console.log("\n✅ E2E user seeding complete");
}

seedUsers()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  });
