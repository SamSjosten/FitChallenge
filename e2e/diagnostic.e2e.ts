// e2e/diagnostic.e2e.ts
// =============================================================================
// DIAGNOSTIC TEST — Validates E2E infrastructure works end-to-end
// =============================================================================
//
// This test validates the complete E2E pipeline:
//
//   Phase 1: Fresh launch → welcome screen reachable (app boots, sync disabled)
//   Phase 2: Sign-in → home screen reachable (auth flow works)
//   Phase 3: Tab navigation → profile screen reachable (post-auth interaction)
//
// Detox synchronization is disabled (see setup.ts launchApp wrapper).
// All interactions use explicit waitFor() timeouts.
//
// Run alone:  detox test --configuration ios.sim.release.iphone16 e2e/diagnostic.e2e.ts --loglevel trace
// =============================================================================

import { by, device, element, expect, waitFor } from "detox";
import { TestIDs } from "@/constants/testIDs";
import { launchApp } from "./setup";

const TEST_EMAIL = "e2e-primary@test.local";
const TEST_PASSWORD = "E2eTestPassword123!";

describe("Diagnostic: E2E Infrastructure", () => {
  // ==========================================================================
  // PHASE 1: Fresh launch — app boots and renders
  // ==========================================================================
  describe("Phase 1: Fresh launch (no session)", () => {
    beforeAll(async () => {
      console.log("[DIAG] ====== PHASE 1: Launching fresh (delete app data) ======");
      await launchApp({ newInstance: true, delete: true });
      console.log("[DIAG] launchApp returned (sync disabled).");
    });

    it("should reach welcome screen", async () => {
      console.log("[DIAG] Phase 1: Waiting for welcome screen...");
      await waitFor(element(by.id(TestIDs.screens.welcome)))
        .toBeVisible()
        .withTimeout(30000);
      console.log("[DIAG] Phase 1: ✅ Welcome screen visible.");
    });
  });

  // ==========================================================================
  // PHASE 2: Sign-in — auth flow completes
  // ==========================================================================
  describe("Phase 2: Sign-in", () => {
    beforeAll(async () => {
      console.log("[DIAG] ====== PHASE 2: Sign in ======");
    });

    it("should sign in and reach home screen", async () => {
      // Navigate to sign-in
      await waitFor(element(by.id(TestIDs.screens.welcome)))
        .toBeVisible()
        .withTimeout(10000);
      await element(by.id(TestIDs.welcome.signInLink)).tap();

      await waitFor(element(by.id(TestIDs.screens.login)))
        .toBeVisible()
        .withTimeout(10000);

      // Sign in
      await element(by.id(TestIDs.auth.emailInput)).replaceText(TEST_EMAIL);
      await element(by.id(TestIDs.auth.passwordInput)).replaceText(TEST_PASSWORD);
      await element(by.id(TestIDs.auth.signInButton)).tap();

      // Wait for home screen
      await waitFor(element(by.id(TestIDs.screensV2.home)))
        .toBeVisible()
        .withTimeout(15000);
      console.log("[DIAG] Phase 2: ✅ Signed in, home screen visible.");
    });
  });

  // ==========================================================================
  // PHASE 3: Post-auth interaction — navigation works
  // ==========================================================================
  describe("Phase 3: Post-auth navigation", () => {
    it("should navigate to profile tab", async () => {
      console.log("[DIAG] Phase 3: Testing post-auth navigation...");

      await waitFor(element(by.id(TestIDs.nav.tabProfile)))
        .toBeVisible()
        .withTimeout(10000);
      await element(by.id(TestIDs.nav.tabProfile)).tap();

      await waitFor(element(by.id(TestIDs.screensV2.profile)))
        .toBeVisible()
        .withTimeout(10000);
      console.log("[DIAG] Phase 3: ✅ Profile screen visible after tab navigation.");
    });

    it("should navigate back to home tab", async () => {
      await waitFor(element(by.id(TestIDs.nav.tabHome)))
        .toBeVisible()
        .withTimeout(10000);
      await element(by.id(TestIDs.nav.tabHome)).tap();

      await waitFor(element(by.id(TestIDs.screensV2.home)))
        .toBeVisible()
        .withTimeout(10000);
      console.log("[DIAG] Phase 3: ✅ Home screen visible after tab switch.");
    });
  });
});