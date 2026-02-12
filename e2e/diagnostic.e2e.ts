// e2e/diagnostic.e2e.ts
// =============================================================================
// DIAGNOSTIC TEST — Validates E2E infrastructure with sync enabled
// =============================================================================
//
// This test validates that the E2E mode flag (EXPO_PUBLIC_E2E=true) successfully
// eliminates persistent timer sources, allowing Detox synchronization to work:
//
//   Phase 1: Fresh launch → welcome screen reachable (sync working at cold start)
//   Phase 2: Sign-in → home screen reachable post-auth (sync working with session)
//   Phase 3: Idle state probe — temporarily disable sync to check for residual work items
//
// Run alone:  detox test --configuration ios.sim.release.iphone16 e2e/diagnostic.e2e.ts --loglevel trace
// =============================================================================

import { by, device, element, expect, waitFor } from "detox";
import { TestIDs } from "@/constants/testIDs";
import { launchApp } from "./setup";

const TEST_EMAIL = "e2e-primary@test.local";
const TEST_PASSWORD = "E2eTestPassword123!";

describe("Diagnostic: Detox Sync State", () => {
  // ==========================================================================
  // PHASE 1: Fresh launch — no session, no auth
  // ==========================================================================
  describe("Phase 1: Fresh launch (no session)", () => {
    beforeAll(async () => {
      console.log("[DIAG] ====== PHASE 1: Launching fresh (delete app data) ======");
      await launchApp({ newInstance: true, delete: true });
      console.log("[DIAG] launchApp returned (sync enabled).");
    });

    it("should reach welcome screen with sync enabled", async () => {
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
  // PHASE 3: Idle state probe — check for residual work items
  // ==========================================================================
  describe("Phase 3: Work item identification", () => {
    beforeAll(async () => {
      console.log("[DIAG] ====== PHASE 3: Relaunch for work item identification ======");
      // Launch fresh with sync enabled (default)
      await launchApp({ newInstance: true, delete: true });
      // Briefly disable sync so we can probe without hanging
      await device.disableSynchronization();
    });

    afterAll(async () => {
      // Re-enable sync for any subsequent test files
      await device.enableSynchronization();
    });

    it("should log device idle status", async () => {
      console.log("[DIAG] Phase 3: Probing app busy status (sync disabled for probe)...");

      // Wait for app to settle, then re-enable sync to trigger busy report
      await waitFor(element(by.id(TestIDs.screens.welcome)))
        .toBeVisible()
        .withTimeout(10000);

      console.log("[DIAG] Phase 3: Welcome screen visible. Re-enabling sync to check idle...");
      await device.enableSynchronization();

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
        } else if (msg.includes("not found")) {
          // Element not found = sync completed, app is idle! That's the success case.
          console.log("[DIAG] Phase 3: ✅ App reached idle state — no persistent work items!");
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