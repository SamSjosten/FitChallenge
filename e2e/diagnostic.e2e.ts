// e2e/diagnostic.e2e.ts
// =============================================================================
// DIAGNOSTIC TEST — Run this FIRST to understand Detox sync state
// =============================================================================
//
// This test does NOT use disableSynchronization(). It deliberately lets Detox
// report what's keeping the app busy at each phase:
//
//   Phase 1: Fresh launch (no session) — is the app idle before auth?
//   Phase 2: After sign-in — what new work items appear?
//   Phase 3: Manual sync check — can we interact after disabling sync?
//
// Read the CI output to see exactly which phase blocks and what Detox reports.
//
// Run alone:  detox test --configuration ios.sim.release.iphone16 e2e/diagnostic.e2e.ts --loglevel trace
// =============================================================================

import { by, device, element, expect, waitFor } from "detox";
import { TestIDs } from "@/constants/testIDs";

const TEST_EMAIL = "e2e-primary@test.local";
const TEST_PASSWORD = "TestPass123!";

describe("Diagnostic: Detox Sync State", () => {
  // ==========================================================================
  // PHASE 1: Fresh launch — no session, no auth
  // ==========================================================================
  describe("Phase 1: Fresh launch (no session)", () => {
    beforeAll(async () => {
      console.log("[DIAG] ====== PHASE 1: Launching fresh (delete app data) ======");
      await device.launchApp({ newInstance: true, delete: true });
      console.log("[DIAG] launchApp returned. If you see this, launch itself is not blocking.");
    });

    it("should reach welcome screen with sync ENABLED", async () => {
      // This is the critical test. If it times out, the app never reaches
      // idle even before any auth or session exists.
      console.log("[DIAG] Phase 1: Waiting for welcome screen WITH sync enabled...");
      try {
        await waitFor(element(by.id(TestIDs.screens.welcome)))
          .toBeVisible()
          .withTimeout(30000);
        console.log("[DIAG] Phase 1: ✅ Welcome screen visible WITH sync. App reached idle.");
      } catch (e) {
        console.log("[DIAG] Phase 1: ❌ TIMEOUT — app never reached idle before auth.");
        console.log("[DIAG] Phase 1: The sync issue exists BEFORE any session/auth/timers.");
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
      // Disable sync just for the sign-in mechanics
      await device.disableSynchronization();

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

      // Re-enable sync to test if app reaches idle after auth
      console.log("[DIAG] Phase 2: Re-enabling sync to test post-auth idle state...");
      await device.enableSynchronization();
    });

    it("should allow interaction with sync ENABLED after auth", async () => {
      console.log("[DIAG] Phase 2: Testing interaction with sync enabled post-auth...");
      try {
        // Simple assertion — if this works, app is idle even with session
        await waitFor(element(by.id(TestIDs.screensV2.home)))
          .toBeVisible()
          .withTimeout(30000);
        console.log("[DIAG] Phase 2: ✅ Home screen visible WITH sync after auth.");
        console.log("[DIAG] Phase 2: Timers are NOT blocking. Problem is elsewhere.");
      } catch (e) {
        console.log("[DIAG] Phase 2: ❌ TIMEOUT — app busy AFTER auth.");
        console.log("[DIAG] Phase 2: Session-related timers are likely the cause.");
        throw e;
      }
    });
  });

  // ==========================================================================
  // PHASE 3: Identify work items — sync disabled, then probe
  // ==========================================================================
  describe("Phase 3: Work item identification", () => {
    beforeAll(async () => {
      console.log("[DIAG] ====== PHASE 3: Relaunch for work item identification ======");
      await device.launchApp({ newInstance: true, delete: true });
      // Don't disable sync — let Detox report what it sees
    });

    it("should log device idle status", async () => {
      console.log("[DIAG] Phase 3: Checking app busy status...");

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
        if (msg.includes("network")) {
          console.log("[DIAG] Phase 3: Network requests pending");
        }
        if (msg.includes("timer")) {
          console.log("[DIAG] Phase 3: JS timers pending");
        }

        // This test "passes" — it's diagnostic, the info is in the logs
        console.log("[DIAG] Phase 3: Diagnostic complete. Check logs above.");
      }
    });
  });
});