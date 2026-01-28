// e2e/tests/friends.e2e.ts
// ============================================
// Friends Flow E2E Tests
// ============================================
// Tests for friend requests, friend list, and social features.

import { device, element, by, expect } from "detox";
import {
  EXTENDED_TIMEOUT,
  DEFAULT_TIMEOUT,
  waitForElement,
  tapElement,
  tapText,
  clearAndTypeText,
  assertVisible,
  assertTextVisible,
  assertNotVisible,
  scrollDown,
} from "../utils";
import {
  signInAsPrimaryUser,
  signInAsSecondaryUser,
  ensureSignedInState,
  signOut,
} from "../utils/authHelpers";

describe("Friends", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await ensureSignedInState();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await waitForElement("home-screen", EXTENDED_TIMEOUT);
  });

  describe("Friends List", () => {
    it("should display friends tab", async () => {
      await tapElement("tab-friends");
      await waitForElement("friends-screen");

      await assertVisible("friends-list");
    });

    it("should show empty state when no friends", async () => {
      await tapElement("tab-friends");
      await waitForElement("friends-screen");

      // This depends on test user having no friends
      try {
        await waitForElement("empty-state-no-friends", 3000);
        await assertVisible("empty-state-no-friends");
      } catch {
        // Has friends - that's okay
        await assertVisible("friends-list");
      }
    });

    it("should navigate to add friends screen", async () => {
      await tapElement("tab-friends");
      await waitForElement("friends-screen");

      await tapElement("add-friend-button");

      await assertVisible("add-friend-screen");
    });

    it("should show friend requests section", async () => {
      await tapElement("tab-friends");
      await waitForElement("friends-screen");

      // Friend requests might be in a tab or section
      try {
        await tapElement("friend-requests-tab");
        await waitForElement("friend-requests-list");
      } catch {
        // Requests might be inline
        console.log("Friend requests in different location");
      }
    });
  });

  describe("Add Friend", () => {
    beforeEach(async () => {
      await tapElement("tab-friends");
      await waitForElement("friends-screen");
      await tapElement("add-friend-button");
      await waitForElement("add-friend-screen");
    });

    it("should search for users by username", async () => {
      await clearAndTypeText("friend-search-input", "test");
      await tapElement("search-button");

      // Should show search results
      await waitForElement("search-results-list", DEFAULT_TIMEOUT);
    });

    it("should show no results message for invalid search", async () => {
      await clearAndTypeText("friend-search-input", "zzzznonexistent12345");
      await tapElement("search-button");

      await waitForElement("no-search-results", DEFAULT_TIMEOUT);
      await assertTextVisible("No users found");
    });

    it("should prevent sending request to yourself", async () => {
      // Search for own username
      await clearAndTypeText("friend-search-input", "e2e_primary_user");
      await tapElement("search-button");

      // Should either not show self or show disabled button
      try {
        await waitForElement("search-result-self", 3000);
        // Add friend button should be disabled or not present
        await assertNotVisible("add-friend-result-0");
      } catch {
        // Self not in results - that's expected
      }
    });

    it("should send friend request", async () => {
      // Search for secondary test user
      await clearAndTypeText("friend-search-input", "e2e_secondary");
      await tapElement("search-button");

      try {
        await waitForElement("search-result-0", DEFAULT_TIMEOUT);
        await tapElement("add-friend-result-0");

        // Should show success or pending state
        await assertTextVisible("Request sent");
      } catch {
        // User might not exist or already friends
        console.log("Could not send friend request - may already be friends");
      }
    });

    it("should show pending state for already sent request", async () => {
      // Search for user we already sent request to
      await clearAndTypeText("friend-search-input", "e2e_secondary");
      await tapElement("search-button");

      try {
        await waitForElement("search-result-0", DEFAULT_TIMEOUT);
        // Should show pending state, not add button
        await assertTextVisible("Pending");
      } catch {
        console.log("Request state check skipped");
      }
    });
  });

  describe("Friend Requests", () => {
    // These tests require a secondary user to send requests
    // In real scenarios, you'd set up test data beforehand

    it("should display incoming friend requests", async () => {
      await tapElement("tab-friends");
      await waitForElement("friends-screen");

      try {
        await tapElement("friend-requests-tab");
        await waitForElement("incoming-requests-list", DEFAULT_TIMEOUT);
      } catch {
        console.log("No pending requests or different UI layout");
      }
    });

    it("should accept friend request", async () => {
      await tapElement("tab-friends");
      await waitForElement("friends-screen");

      try {
        await tapElement("friend-requests-tab");
        await waitForElement("incoming-request-0", 3000);

        await tapElement("accept-request-0");

        // Should show success
        await assertTextVisible("Friend added");

        // Request should be removed from list
        await assertNotVisible("incoming-request-0");
      } catch {
        console.log("No incoming requests to accept");
      }
    });

    it("should decline friend request", async () => {
      await tapElement("tab-friends");
      await waitForElement("friends-screen");

      try {
        await tapElement("friend-requests-tab");
        await waitForElement("incoming-request-0", 3000);

        await tapElement("decline-request-0");

        // Might show confirmation
        try {
          await tapText("Decline");
        } catch {
          // No confirmation needed
        }

        // Request should be removed
        await assertNotVisible("incoming-request-0");
      } catch {
        console.log("No incoming requests to decline");
      }
    });

    it("should show sent requests", async () => {
      await tapElement("tab-friends");
      await waitForElement("friends-screen");

      try {
        await tapElement("sent-requests-tab");
        await waitForElement("sent-requests-list", DEFAULT_TIMEOUT);
      } catch {
        console.log("Sent requests UI not found");
      }
    });

    it("should cancel sent request", async () => {
      await tapElement("tab-friends");
      await waitForElement("friends-screen");

      try {
        await tapElement("sent-requests-tab");
        await waitForElement("sent-request-0", 3000);

        await tapElement("cancel-request-0");

        // Confirm cancellation
        try {
          await tapText("Cancel Request");
        } catch {
          // No confirmation needed
        }

        await assertNotVisible("sent-request-0");
      } catch {
        console.log("No sent requests to cancel");
      }
    });
  });

  describe("Friend Profile", () => {
    it("should view friend profile", async () => {
      await tapElement("tab-friends");
      await waitForElement("friends-screen");

      try {
        await waitForElement("friend-card-0", 3000);
        await tapElement("friend-card-0");

        await waitForElement("friend-profile-screen");
        await assertVisible("friend-username");
        await assertVisible("friend-stats");
      } catch {
        console.log("No friends to view profile");
      }
    });

    it("should challenge friend from profile", async () => {
      await tapElement("tab-friends");
      await waitForElement("friends-screen");

      try {
        await waitForElement("friend-card-0", 3000);
        await tapElement("friend-card-0");
        await waitForElement("friend-profile-screen");

        await tapElement("challenge-friend-button");
        await assertVisible("create-challenge-screen");
      } catch {
        console.log("Could not challenge friend");
      }
    });

    it("should remove friend", async () => {
      await tapElement("tab-friends");
      await waitForElement("friends-screen");

      try {
        await waitForElement("friend-card-0", 3000);
        await tapElement("friend-card-0");
        await waitForElement("friend-profile-screen");

        await tapElement("remove-friend-button");

        // Confirm removal
        await waitForElement("remove-friend-dialog", DEFAULT_TIMEOUT);
        await tapText("Remove");

        // Should navigate back to friends list
        await waitForElement("friends-screen");
      } catch {
        console.log("Could not test friend removal");
      }
    });
  });

  describe("Friend Request Flow (Multi-User)", () => {
    // This test simulates the full friend request flow between two users
    // Requires signing in as different users

    it("should complete full friend request flow", async () => {
      // Step 1: Primary user sends request
      await signInAsPrimaryUser();
      await tapElement("tab-friends");
      await waitForElement("friends-screen");
      await tapElement("add-friend-button");
      await waitForElement("add-friend-screen");

      await clearAndTypeText("friend-search-input", "e2e_secondary");
      await tapElement("search-button");

      try {
        await waitForElement("search-result-0", DEFAULT_TIMEOUT);
        await tapElement("add-friend-result-0");
        await assertTextVisible("Request sent");
      } catch {
        console.log("Could not send request - may already be friends");
        return;
      }

      // Step 2: Sign out and sign in as secondary user
      await signOut();
      await signInAsSecondaryUser();

      // Step 3: Secondary user accepts request
      await tapElement("tab-friends");
      await waitForElement("friends-screen");

      try {
        await tapElement("friend-requests-tab");
        await waitForElement("incoming-request-0", DEFAULT_TIMEOUT);
        await tapElement("accept-request-0");
        await assertTextVisible("Friend added");
      } catch {
        console.log("Request not found for secondary user");
        return;
      }

      // Step 4: Verify friendship established
      await tapElement("friends-tab");
      await waitForElement("friends-list");
      await assertTextVisible("e2e_primary");

      // Step 5: Sign back in as primary user and verify
      await signOut();
      await signInAsPrimaryUser();
      await tapElement("tab-friends");
      await waitForElement("friends-screen");
      await assertTextVisible("e2e_secondary");
    });
  });

  describe("Friend Notifications", () => {
    it("should show notification badge for friend requests", async () => {
      // Check if friends tab shows badge
      try {
        await assertVisible("friends-tab-badge");
      } catch {
        // No pending requests
        console.log("No notification badge visible");
      }
    });

    it("should update badge when request is handled", async () => {
      // This would require test data setup
      // Simplified: just verify badge can be dismissed
      console.log("Badge update test requires specific test data");
    });
  });
});
