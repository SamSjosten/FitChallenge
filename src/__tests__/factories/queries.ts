// src/__tests__/component/factories/queries.ts
// Query utilities for component tests
// Provides safe helpers for common testing patterns

import { within, RenderAPI } from "@testing-library/react-native";

/**
 * Safely get first element when multiple match
 * Use when a text pattern appears multiple times (e.g., headers + buttons)
 */
export function getFirstByText(
  renderResult: RenderAPI,
  text: string | RegExp,
): ReturnType<RenderAPI["getByText"]> {
  const elements = renderResult.getAllByText(text);
  if (elements.length === 0) {
    throw new Error(`Unable to find any elements with text: ${text}`);
  }
  return elements[0];
}

/**
 * Safely get element by index when multiple match
 * Returns null if index out of bounds (safer than direct array access)
 */
export function getByTextAtIndex(
  renderResult: RenderAPI,
  text: string | RegExp,
  index: number,
): ReturnType<RenderAPI["getByText"]> | null {
  try {
    const elements = renderResult.getAllByText(text);
    return elements[index] || null;
  } catch {
    return null;
  }
}

/**
 * Get text within a specific container
 * Useful for scoping queries to a specific section of the UI
 */
export function getTextWithinTestId(
  renderResult: RenderAPI,
  testId: string,
  text: string | RegExp,
): ReturnType<RenderAPI["getByText"]> {
  const container = renderResult.getByTestId(testId);
  return within(container).getByText(text);
}

/**
 * Query text within a specific container (returns null if not found)
 */
export function queryTextWithinTestId(
  renderResult: RenderAPI,
  testId: string,
  text: string | RegExp,
): ReturnType<RenderAPI["queryByText"]> {
  try {
    const container = renderResult.getByTestId(testId);
    return within(container).queryByText(text);
  } catch {
    return null;
  }
}

/**
 * Find button by accessible role or text
 * Handles cases where buttons might have icons + text
 */
export function findButtonByText(
  renderResult: RenderAPI,
  text: string | RegExp,
): ReturnType<RenderAPI["getAllByText"]> {
  return renderResult.getAllByText(text);
}

/**
 * Count elements matching text
 * Useful for assertions like "should show 3 challenge cards"
 */
export function countByText(renderResult: RenderAPI, text: string | RegExp): number {
  try {
    return renderResult.getAllByText(text).length;
  } catch {
    return 0;
  }
}

/**
 * Wait for element and return first match
 * Combines waitFor with getAllByText pattern
 */
export async function waitForFirstByText(
  renderResult: RenderAPI,
  text: string | RegExp,
  options?: Parameters<RenderAPI["findAllByText"]>[1],
): Promise<ReturnType<RenderAPI["getByText"]>> {
  const elements = await renderResult.findAllByText(text, options);
  return elements[0];
}
