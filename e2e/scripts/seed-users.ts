import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

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
// IMPORTANT: The handle_new_user trigger reads these specific metadata keys:
//   - 'username' → profiles.username (falls back to user_<uuid> if missing)
//   - 'full_name' → profiles.display_name (falls back to 'name' key if missing)
const testUsers = [
  {
    email: "e2e-primary@test.local",
    password: "E2eTestPassword123!",
    userData: { username: "e2eprimary", full_name: "E2E Primary User" },
  },
  {
    email: "e2e-secondary@test.local",
    password: "E2eTestPassword123!",
    userData: { username: "e2esecondary", full_name: "E2E Secondary User" },
  },
  {
    email: "e2e-friend@test.local",
    password: "E2eTestPassword123!",
    userData: { username: "e2efriend", full_name: "E2E Friend User" },
  },
];

async function seedUsers() {
  console.log("🌱 Seeding E2E test users...\n");

  // Fetch existing users once to find stale test accounts.
  // This is a single API call regardless of how many test users we have.
  const { data: listData, error: listError } =
    await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (listError) {
    console.error("❌ Failed to list existing users:", listError.message);
    process.exit(1);
  }

  if (!listData) {
    console.error("❌ No data returned from listUsers");
    process.exit(1);
  }

  const existingUsers: User[] = listData.users;

  for (const user of testUsers) {
    try {
      // Check if this test user already exists with potentially stale metadata.
      // The handle_new_user trigger only fires on INSERT — it does NOT re-fire
      // when metadata is updated. So we must delete and recreate to ensure
      // the trigger runs with the current userData (username, full_name).
      const existing = existingUsers.find((u) => u.email === user.email);

      if (existing) {
        const { error: deleteError } =
          await supabase.auth.admin.deleteUser(existing.id);
        if (deleteError) {
          console.error(
            `✗ Failed to delete stale ${user.email}: ${deleteError.message}`,
          );
          continue;
        }
        console.log(`♻ Deleted stale: ${user.email} (id: ${existing.id})`);
      }

      // Create fresh — trigger fires with current metadata
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: user.userData,
      });

      if (error) {
        console.error(`✗ Failed to create ${user.email}: ${error.message}`);
      } else {
        console.log(`✓ Created: ${user.email} (id: ${data.user?.id})`);
      }
    } catch (err) {
      console.error(`✗ Error with ${user.email}:`, err);
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
