// e2e/diagnostic.e2e.ts
// =============================================================================
// DIAGNOSTIC TEST — Validates sync-disabled E2E infrastructure
// =============================================================================
//
// This test validates that the sync-disabled launch flow works correctly:
//
//   Phase 1: Fresh launch → welcome screen reachable
//   Phase 2: Sign-in → home screen reachable post-auth
//   Phase 3: Work item identification (sync re-enabled briefly, isolated)
//
// Run alone:  detox test --configuration ios.sim.release.iphone16 e2e/diagnostic.e2e.ts --loglevel trace
// =============================================================================

import { by, device, element, expect, waitFor } from "detox";
import { TestIDs } from "@/constants/testIDs";
import { launchApp } from "./setup";

const TEST_EMAIL = "e2e-primary@test.local";
const TEST_PASSWORD = "TestPass123!";

describe("Diagnostic: Detox Sync State", () => {
  // ==========================================================================
  // PHASE 1: Fresh launch — no session, no auth
  // ==========================================================================
  describe("Phase 1: Fresh launch (no session)", () => {
    beforeAll(async () => {
      console.log("[DIAG] ====== PHASE 1: Launching fresh (delete app data) ======");
      await launchApp({ newInstance: true, delete: true });
      console.log("[DIAG] launchApp returned (sync disabled).");
    });

    it("should reach welcome screen with sync disabled", async () => {
      console.log("[DIAG] Phase 1: Waiting for welcome screen...");
      try {
        await waitFor(element(by.id(TestIDs.screens.welcome)))
          .toBeVisible()
          .withTimeout(30000);
        console.log("[DIAG] Phase 1: ✅ Welcome screen visible.");
      } catch (e) {
        console.log("[DIAG] Phase 1: ❌ TIMEOUT — welcome screen not reachable.");
        throw e;
      }
    });
  });

  // ==========================================================================
  // PHASE 2: After sign-in — session active, timers running
  // ==========================================================================
  describe("Phase 2: After sign-in", () => {
    beforeAll(async () => {
      console.log("[DIAG] ====== PHASE 2: Sign in to create session ======");

      try {
        // Navigate to sign-in
        await waitFor(element(by.id(TestIDs.screens.welcome)))
          .toBeVisible()
          .withTimeout(10000);
        await element(by.id(TestIDs.welcome.signInLink)).tap();
        await waitFor(element(by.id(TestIDs.screens.login)))
          .toBeVisible()
          .withTimeout(5000);

        // Sign in
        await element(by.id(TestIDs.auth.emailInput)).replaceText(TEST_EMAIL);
        await element(by.id(TestIDs.auth.passwordInput)).replaceText(TEST_PASSWORD);
        await element(by.id(TestIDs.auth.signInButton)).tap();

        // Wait for home screen
        await waitFor(element(by.id(TestIDs.screensV2.home)))
          .toBeVisible()
          .withTimeout(15000);
        console.log("[DIAG] Phase 2: Signed in, home screen visible.");
      } catch (e) {
        console.log("[DIAG] Phase 2: Sign-in failed:", (e as Error).message);
        throw e;
      }
    });

    it("should allow interaction after sign-in", async () => {
      console.log("[DIAG] Phase 2: Testing interaction post-auth...");
      try {
        await waitFor(element(by.id(TestIDs.screensV2.home)))
          .toBeVisible()
          .withTimeout(30000);
        console.log("[DIAG] Phase 2: ✅ Home screen visible after auth.");
      } catch (e) {
        console.log("[DIAG] Phase 2: ❌ TIMEOUT — home not reachable after auth.");
        throw e;
      }
    });
  });

  // ==========================================================================
  // PHASE 3: Work item identification — relaunch and probe
  // ==========================================================================
  describe("Phase 3: Work item identification", () => {
    beforeAll(async () => {
      console.log("[DIAG] ====== PHASE 3: Relaunch for work item identification ======");
      // Launch fresh — sync is disabled by launchApp()
      await launchApp({ newInstance: true, delete: true });
      // Briefly re-enable sync to let Detox report what it sees.
      // This is safe because it's the LAST phase — no subsequent describes
      // in this file, and Jest runs each file in a separate worker.
      await device.enableSynchronization();
    });

    afterAll(async () => {
      // Restore sync-disabled state in case Detox reuses this worker
      await device.disableSynchronization();
    });

    it("should log device idle status", async () => {
      console.log("[DIAG] Phase 3: Checking app busy status (sync enabled)...");

      // Try a short timeout to trigger the busy report quickly
      try {
        await waitFor(element(by.id("nonexistent-element-for-diagnostic")))
          .toBeVisible()
          .withTimeout(15000);
      } catch (e) {
        // Expected to fail — we want the busy report in the logs
        const msg = (e as Error).message || "";
        console.log("[DIAG] Phase 3: Detox busy report:");
        console.log("[DIAG]", msg);

        // Parse out useful info
        if (msg.includes("work items pending")) {
          const match = msg.match(/(\d+) work items pending/);
          console.log(`[DIAG] Phase 3: Found ${match?.[1] || "?"} work items on main queue`);
        }
        if (msg.includes("Run loop")) {
          console.log("[DIAG] Phase 3: Main run loop is awake");
        }

        // This test "passes" — it's diagnostic, the info is in the logs
        console.log("[DIAG] Phase 3: Diagnostic complete. Check logs above.");
      }
    });
  });
});