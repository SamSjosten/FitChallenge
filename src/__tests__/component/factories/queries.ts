import { screen, within } from "@testing-library/react-native";
import type { ReactTestInstance } from "react-test-renderer";

export const getByTextWithin = (
  container: ReactTestInstance,
  text: string | RegExp,
): ReactTestInstance => within(container).getByText(text);

export const queryByTextWithin = (
  container: ReactTestInstance,
  text: string | RegExp,
): ReactTestInstance | null => within(container).queryByText(text);

export const getAllByTextWithin = (
  container: ReactTestInstance,
  text: string | RegExp,
): ReactTestInstance[] => within(container).getAllByText(text);

export const getFirstByText = (text: string | RegExp): ReactTestInstance =>
  screen.getAllByText(text)[0];

export const getNthByText = (
  text: string | RegExp,
  n: number,
): ReactTestInstance => {
  const elements = screen.getAllByText(text);
  if (elements.length < n) {
    throw new Error(
      `Expected at least ${n} elements with text "${text}", found ${elements.length}`,
    );
  }
  return elements[n - 1];
};

export const findContainerByText = (
  text: string | RegExp,
): ReactTestInstance => {
  const element = screen.getByText(text);
  let current: ReactTestInstance | null = element.parent;
  while (current && current.type !== "View") {
    current = current.parent;
  }
  if (!current) {
    throw new Error(`Could not find container for element with text "${text}"`);
  }
  return current;
};

export const getCardByTestId = (testId: string): ReactTestInstance =>
  screen.getByTestId(testId);
