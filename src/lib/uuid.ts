// src/lib/uuid.ts
// Cryptographically secure UUID generation for idempotency keys

import * as ExpoCrypto from "expo-crypto";

/**
 * Generate a cryptographically secure UUID v4 for client_event_id
 * This is the idempotency key for activity logging
 *
 * Priority:
 * 1. expo-crypto (React Native)
 * 2. Web Crypto API (browsers, Node 19+)
 * 3. crypto.getRandomValues fallback
 * 4. Error (no insecure fallback)
 *
 * @returns UUID v4 string (e.g., "550e8400-e29b-41d4-a716-446655440000")
 */
export function generateClientEventId(): string {
  // Option 1: expo-crypto (React Native)
  // This is the primary path for the mobile app
  if (typeof ExpoCrypto?.randomUUID === "function") {
    return ExpoCrypto.randomUUID();
  }

  // Option 2: Web Crypto API (browsers, Node.js 19+)
  // Fallback for web builds or test environments
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Option 3: crypto.getRandomValues fallback
  // For older environments with partial Web Crypto support
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
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
      16,
    )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // No secure random source available - fail rather than use Math.random()
  throw new Error(
    "No secure random source available. " +
      "Ensure expo-crypto is installed for React Native, " +
      "or run in an environment with Web Crypto API support.",
  );
}
