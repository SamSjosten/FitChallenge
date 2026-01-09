// src/lib/uuid.ts
// Cryptographically secure UUID generation for idempotency keys

/**
 * Generate a cryptographically secure UUID v4 for client_event_id
 * This is the idempotency key for activity logging
 *
 * Uses crypto.randomUUID() which provides:
 * - Cryptographically secure random number generation
 * - Proper entropy for collision resistance
 * - Native implementation (fast, no external deps)
 *
 * @returns UUID v4 string (e.g., "550e8400-e29b-41d4-a716-446655440000")
 */
export function generateClientEventId(): string {
  // crypto.randomUUID() is available in:
  // - React Native 0.64+ with Hermes
  // - Modern browsers
  // - Node.js 19+ (or 14.17+ with --experimental-global-webcrypto)
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  // Fallback for environments without crypto.randomUUID
  // This should rarely be hit in practice with modern React Native
  // Uses crypto.getRandomValues for secure randomness
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    // Set version (4) and variant (RFC 4122)
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant RFC 4122

    // Convert to hex string with dashes
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
      12,
      16
    )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Final fallback - throw error rather than use insecure Math.random()
  throw new Error(
    "crypto.randomUUID or crypto.getRandomValues not available. " +
      "Ensure you are running in a secure environment (React Native with Hermes, modern browser, or Node.js 19+)."
  );
}
