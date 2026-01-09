// src/lib/__tests__/generateClientEventId.test.ts
// Tests for cryptographically secure UUID generation

import { generateClientEventId } from "../uuid";

describe("generateClientEventId", () => {
  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // where x is any hex digit and y is one of 8, 9, a, or b
  const UUID_V4_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  describe("format validation", () => {
    test("returns a string", () => {
      const result = generateClientEventId();
      expect(typeof result).toBe("string");
    });

    test("returns a valid UUID v4 format", () => {
      const result = generateClientEventId();
      expect(result).toMatch(UUID_V4_REGEX);
    });

    test("has correct length (36 characters including dashes)", () => {
      const result = generateClientEventId();
      expect(result.length).toBe(36);
    });

    test("has dashes at correct positions (8, 13, 18, 23)", () => {
      const result = generateClientEventId();
      expect(result[8]).toBe("-");
      expect(result[13]).toBe("-");
      expect(result[18]).toBe("-");
      expect(result[23]).toBe("-");
    });

    test("has version 4 indicator at position 14", () => {
      const result = generateClientEventId();
      expect(result[14]).toBe("4");
    });

    test("has correct variant bits at position 19 (8, 9, a, or b)", () => {
      const result = generateClientEventId();
      expect(["8", "9", "a", "b"]).toContain(result[19].toLowerCase());
    });

    test("contains only valid hex characters and dashes", () => {
      const result = generateClientEventId();
      expect(result).toMatch(/^[0-9a-f-]+$/i);
    });
  });

  describe("uniqueness properties", () => {
    test("generates unique IDs on consecutive calls", () => {
      const id1 = generateClientEventId();
      const id2 = generateClientEventId();
      expect(id1).not.toBe(id2);
    });

    test("generates 100 unique IDs with no collisions", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateClientEventId());
      }
      expect(ids.size).toBe(100);
    });

    test("generates 1000 unique IDs with no collisions", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        ids.add(generateClientEventId());
      }
      expect(ids.size).toBe(1000);
    });
  });

  describe("consistency", () => {
    test("all generated IDs match UUID v4 format (batch of 100)", () => {
      for (let i = 0; i < 100; i++) {
        const id = generateClientEventId();
        expect(id).toMatch(UUID_V4_REGEX);
      }
    });

    test("version and variant bits are consistent across multiple generations", () => {
      for (let i = 0; i < 50; i++) {
        const id = generateClientEventId();
        // Version 4
        expect(id[14]).toBe("4");
        // Variant (RFC 4122): 8, 9, a, or b
        expect(["8", "9", "a", "b"]).toContain(id[19].toLowerCase());
      }
    });
  });

  describe("entropy distribution", () => {
    test("generates varied hex characters (not stuck on same values)", () => {
      // Generate several UUIDs and check that we see variety in the random portions
      const ids = Array.from({ length: 20 }, () => generateClientEventId());

      // Extract just the random hex chars (excluding version/variant fixed bits)
      // Positions 0-7, 9-12, 15-17, 20-22, 24-35 are random
      const randomChars = ids
        .map(
          (id) =>
            id.replace(/-/g, "").slice(0, 12) + // First 12 random
            id.replace(/-/g, "").slice(13, 16) + // Skip version, next 3
            id.replace(/-/g, "").slice(17) // Skip variant, rest
        )
        .join("");

      // Should have decent variety - at least 10 different hex chars used
      const uniqueChars = new Set(randomChars.toLowerCase().split(""));
      expect(uniqueChars.size).toBeGreaterThanOrEqual(10);
    });
  });
});
