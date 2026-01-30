// src/__tests__/unit/navigation/tabPreservation.unit.test.ts
// ============================================
// Tab Preservation Logic Tests
// Tests that tabs are preserved during version redirects
// ============================================

/**
 * VALID_TAB_NAMES is defined in app/_layout.tsx
 * This test validates the expected behavior:
 *
 * When a user navigates to a tab in the wrong version:
 * - /(tabs)/friends with uiVersion=v2 → /(tabs-v2)/friends
 * - /(tabs-v2)/challenges with uiVersion=v1 → /(tabs)/challenges
 *
 * When the segment is not a valid tab:
 * - /(tabs)/unknown with uiVersion=v2 → /(tabs-v2) (home)
 */

// Recreate the logic from _layout.tsx for testing
const VALID_TAB_NAMES = new Set([
  "index",
  "challenges",
  "friends",
  "profile",
  "create",
]);

type UIVersion = "v1" | "v2";

interface RouteSegments {
  firstSegment: string | undefined;
  secondSegment: string | undefined;
}

interface RedirectResult {
  shouldRedirect: boolean;
  targetPath: string | null;
}

/**
 * Core logic extracted from useProtectedRoute for testing
 * This mirrors the logic in app/_layout.tsx
 */
function computeTabRedirect(
  segments: RouteSegments,
  uiVersion: UIVersion,
): RedirectResult {
  const { firstSegment, secondSegment } = segments;

  // Determine if we're in tabs
  const inV1Tabs = firstSegment === "(tabs)";
  const inV2Tabs = firstSegment === "(tabs-v2)";

  // Check for version mismatch
  const inWrongTabs =
    (uiVersion === "v2" && inV1Tabs) || (uiVersion === "v1" && inV2Tabs);

  if (!inWrongTabs) {
    return { shouldRedirect: false, targetPath: null };
  }

  // Determine target tabs group
  const targetTabs = uiVersion === "v2" ? "/(tabs-v2)" : "/(tabs)";

  // Preserve the specific tab if valid
  let targetPath = targetTabs;
  if (secondSegment && VALID_TAB_NAMES.has(secondSegment)) {
    targetPath = `${targetTabs}/${secondSegment}`;
  }

  return { shouldRedirect: true, targetPath };
}

describe("Tab Preservation Logic", () => {
  describe("V1 to V2 redirects (uiVersion=v2)", () => {
    const uiVersion: UIVersion = "v2";

    it("preserves friends tab: /(tabs)/friends → /(tabs-v2)/friends", () => {
      const result = computeTabRedirect(
        { firstSegment: "(tabs)", secondSegment: "friends" },
        uiVersion,
      );
      expect(result.shouldRedirect).toBe(true);
      expect(result.targetPath).toBe("/(tabs-v2)/friends");
    });

    it("preserves challenges tab: /(tabs)/challenges → /(tabs-v2)/challenges", () => {
      const result = computeTabRedirect(
        { firstSegment: "(tabs)", secondSegment: "challenges" },
        uiVersion,
      );
      expect(result.shouldRedirect).toBe(true);
      expect(result.targetPath).toBe("/(tabs-v2)/challenges");
    });

    it("preserves profile tab: /(tabs)/profile → /(tabs-v2)/profile", () => {
      const result = computeTabRedirect(
        { firstSegment: "(tabs)", secondSegment: "profile" },
        uiVersion,
      );
      expect(result.shouldRedirect).toBe(true);
      expect(result.targetPath).toBe("/(tabs-v2)/profile");
    });

    it("preserves create tab: /(tabs)/create → /(tabs-v2)/create", () => {
      const result = computeTabRedirect(
        { firstSegment: "(tabs)", secondSegment: "create" },
        uiVersion,
      );
      expect(result.shouldRedirect).toBe(true);
      expect(result.targetPath).toBe("/(tabs-v2)/create");
    });

    it("preserves index (home): /(tabs)/index → /(tabs-v2)/index", () => {
      const result = computeTabRedirect(
        { firstSegment: "(tabs)", secondSegment: "index" },
        uiVersion,
      );
      expect(result.shouldRedirect).toBe(true);
      expect(result.targetPath).toBe("/(tabs-v2)/index");
    });

    it("falls back to home for unknown segment: /(tabs)/unknown → /(tabs-v2)", () => {
      const result = computeTabRedirect(
        { firstSegment: "(tabs)", secondSegment: "unknown" },
        uiVersion,
      );
      expect(result.shouldRedirect).toBe(true);
      expect(result.targetPath).toBe("/(tabs-v2)");
    });

    it("falls back to home when no second segment: /(tabs) → /(tabs-v2)", () => {
      const result = computeTabRedirect(
        { firstSegment: "(tabs)", secondSegment: undefined },
        uiVersion,
      );
      expect(result.shouldRedirect).toBe(true);
      expect(result.targetPath).toBe("/(tabs-v2)");
    });
  });

  describe("V2 to V1 redirects (uiVersion=v1)", () => {
    const uiVersion: UIVersion = "v1";

    it("preserves friends tab: /(tabs-v2)/friends → /(tabs)/friends", () => {
      const result = computeTabRedirect(
        { firstSegment: "(tabs-v2)", secondSegment: "friends" },
        uiVersion,
      );
      expect(result.shouldRedirect).toBe(true);
      expect(result.targetPath).toBe("/(tabs)/friends");
    });

    it("preserves challenges tab: /(tabs-v2)/challenges → /(tabs)/challenges", () => {
      const result = computeTabRedirect(
        { firstSegment: "(tabs-v2)", secondSegment: "challenges" },
        uiVersion,
      );
      expect(result.shouldRedirect).toBe(true);
      expect(result.targetPath).toBe("/(tabs)/challenges");
    });

    it("falls back to home for unknown segment: /(tabs-v2)/unknown → /(tabs)", () => {
      const result = computeTabRedirect(
        { firstSegment: "(tabs-v2)", secondSegment: "unknown" },
        uiVersion,
      );
      expect(result.shouldRedirect).toBe(true);
      expect(result.targetPath).toBe("/(tabs)");
    });
  });

  describe("No redirect needed (correct version)", () => {
    it("V1 user in V1 tabs: no redirect", () => {
      const result = computeTabRedirect(
        { firstSegment: "(tabs)", secondSegment: "friends" },
        "v1",
      );
      expect(result.shouldRedirect).toBe(false);
      expect(result.targetPath).toBe(null);
    });

    it("V2 user in V2 tabs: no redirect", () => {
      const result = computeTabRedirect(
        { firstSegment: "(tabs-v2)", secondSegment: "friends" },
        "v2",
      );
      expect(result.shouldRedirect).toBe(false);
      expect(result.targetPath).toBe(null);
    });
  });

  describe("Non-tab segments (no redirect)", () => {
    it("auth segment: no redirect", () => {
      const result = computeTabRedirect(
        { firstSegment: "(auth)", secondSegment: "login" },
        "v2",
      );
      expect(result.shouldRedirect).toBe(false);
    });

    it("settings segment: no redirect", () => {
      const result = computeTabRedirect(
        { firstSegment: "settings", secondSegment: "index" },
        "v2",
      );
      expect(result.shouldRedirect).toBe(false);
    });
  });
});

describe("VALID_TAB_NAMES constant", () => {
  it("contains exactly 5 valid tab names", () => {
    expect(VALID_TAB_NAMES.size).toBe(5);
  });

  it("contains all expected tabs", () => {
    expect(VALID_TAB_NAMES.has("index")).toBe(true);
    expect(VALID_TAB_NAMES.has("challenges")).toBe(true);
    expect(VALID_TAB_NAMES.has("friends")).toBe(true);
    expect(VALID_TAB_NAMES.has("profile")).toBe(true);
    expect(VALID_TAB_NAMES.has("create")).toBe(true);
  });

  it("does not contain invalid tabs", () => {
    expect(VALID_TAB_NAMES.has("settings")).toBe(false);
    expect(VALID_TAB_NAMES.has("notifications")).toBe(false);
    expect(VALID_TAB_NAMES.has("unknown")).toBe(false);
  });
});
