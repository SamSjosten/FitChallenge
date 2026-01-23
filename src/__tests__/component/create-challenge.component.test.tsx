// src/__tests__/component/create-challenge.component.test.tsx
// Component tests for the Create Challenge screen

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import CreateChallengeScreen from "@/app/challenge/create";
import { mockChallengesState, mockRouter } from "./jest.setup";
import { getNthByText } from "./factories";
import { Alert } from "react-native";

// Mock Alert
jest.spyOn(Alert, "alert");

// =============================================================================
// TESTS
// =============================================================================

describe("CreateChallengeScreen", () => {
  describe("Rendering", () => {
    it("renders the Create Challenge header", () => {
      render(<CreateChallengeScreen />);
      // "Create Challenge" appears in both header and submit button
      const elements = screen.getAllByText("Create Challenge");
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it("renders title input field", () => {
      render(<CreateChallengeScreen />);
      expect(screen.getByText("Challenge Title")).toBeTruthy();
      expect(
        screen.getByPlaceholderText("e.g., Summer Step Challenge"),
      ).toBeTruthy();
    });

    it("renders activity type selector with all options", () => {
      render(<CreateChallengeScreen />);
      expect(screen.getByText("Activity Type")).toBeTruthy();
      expect(screen.getByText("👟")).toBeTruthy(); // Steps icon
      expect(screen.getByText("⏱️")).toBeTruthy(); // Active Minutes icon
      expect(screen.getByText("💪")).toBeTruthy(); // Workouts icon
      expect(screen.getByText("🏃")).toBeTruthy(); // Distance icon
      expect(screen.getByText("✨")).toBeTruthy(); // Custom icon
    });

    it("renders goal input field", () => {
      render(<CreateChallengeScreen />);
      // Goal label includes the unit, e.g., "Goal (steps)"
      expect(screen.getByText(/^Goal \(/)).toBeTruthy();
      expect(screen.getByPlaceholderText("e.g., 10000")).toBeTruthy();
    });

    it("renders duration presets", () => {
      render(<CreateChallengeScreen />);
      expect(screen.getByText("Duration")).toBeTruthy();
      expect(screen.getByText("7 days")).toBeTruthy();
      expect(screen.getByText("14 days")).toBeTruthy();
      expect(screen.getByText("30 days")).toBeTruthy();
      const customElements = screen.getAllByText("Custom");
      expect(customElements.length).toBeGreaterThanOrEqual(2);
    });

    it("renders start time options", () => {
      render(<CreateChallengeScreen />);
      expect(screen.getByText("When to Start")).toBeTruthy();
      expect(screen.getByText("Start Now")).toBeTruthy();
      expect(screen.getByText("Schedule")).toBeTruthy();
    });

    it("renders summary card", () => {
      render(<CreateChallengeScreen />);
      expect(screen.getByText("Challenge Summary")).toBeTruthy();
    });

    it("renders Create Challenge button", () => {
      render(<CreateChallengeScreen />);
      // There might be multiple elements with this text (header + button)
      const buttons = screen.getAllByText("Create Challenge");
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });

    it("renders Cancel button", () => {
      render(<CreateChallengeScreen />);
      expect(screen.getByText("Cancel")).toBeTruthy();
    });
  });

  describe("Navigation", () => {
    it("navigates back when Cancel button is pressed", () => {
      render(<CreateChallengeScreen />);

      const cancelButton = screen.getByText("Cancel");
      fireEvent.press(cancelButton);

      expect(mockRouter.back).toHaveBeenCalled();
    });
  });

  describe("Form Interaction", () => {
    it("updates title when typed", () => {
      render(<CreateChallengeScreen />);

      const titleInput = screen.getByPlaceholderText(
        "e.g., Summer Step Challenge",
      );
      fireEvent.changeText(titleInput, "My Step Challenge");

      expect(titleInput.props.value).toBe("My Step Challenge");
    });

    it("updates goal when typed", () => {
      render(<CreateChallengeScreen />);

      const goalInput = screen.getByPlaceholderText("e.g., 10000");
      fireEvent.changeText(goalInput, "50000");

      expect(goalInput.props.value).toBe("50000");
    });

    it("selects duration preset when pressed", () => {
      render(<CreateChallengeScreen />);

      const fourteenDays = screen.getByText("14 days");
      fireEvent.press(fourteenDays);

      // Summary should update to reflect 14 days (appears in button and summary)
      const elements = screen.getAllByText(/14 days/);
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it("shows custom duration input when Custom is selected", () => {
      render(<CreateChallengeScreen />);

      fireEvent.press(getNthByText("Custom", 2));

      expect(screen.getByPlaceholderText("Number of days")).toBeTruthy();
    });

    it("shows custom activity fields when Custom type is selected", () => {
      render(<CreateChallengeScreen />);

      const customType = screen.getByText("✨");
      fireEvent.press(customType);

      expect(screen.getByText("Activity Name")).toBeTruthy();
      expect(
        screen.getByPlaceholderText("e.g., Pushups, Meditation"),
      ).toBeTruthy();
      expect(screen.getByText("Unit")).toBeTruthy();
      expect(screen.getByPlaceholderText("e.g., reps, minutes")).toBeTruthy();
    });
  });

  describe("Validation", () => {
    it("shows error when title is empty", async () => {
      render(<CreateChallengeScreen />);

      // Fill in goal but leave title empty
      const goalInput = screen.getByPlaceholderText("e.g., 10000");
      fireEvent.changeText(goalInput, "50000");

      // Try to create
      const createButtons = screen.getAllByText("Create Challenge");
      const createButton = createButtons[createButtons.length - 1]; // Get the button, not header
      fireEvent.press(createButton);

      expect(screen.getByText("Title is required")).toBeTruthy();
    });

    it("shows error when goal is invalid", async () => {
      render(<CreateChallengeScreen />);

      // Fill in title but leave goal at 0/empty
      const titleInput = screen.getByPlaceholderText(
        "e.g., Summer Step Challenge",
      );
      fireEvent.changeText(titleInput, "My Challenge");

      // Goal input stays at empty or 0
      const goalInput = screen.getByPlaceholderText("e.g., 10000");
      fireEvent.changeText(goalInput, "0");

      const createButtons = screen.getAllByText("Create Challenge");
      const createButton = createButtons[createButtons.length - 1];
      fireEvent.press(createButton);

      expect(screen.getByText("Please enter a valid goal")).toBeTruthy();
    });

    it("shows error when custom activity name is empty for custom type", async () => {
      render(<CreateChallengeScreen />);

      // Select custom type
      const customType = screen.getByText("✨");
      fireEvent.press(customType);

      // Fill in title and goal
      const titleInput = screen.getByPlaceholderText(
        "e.g., Summer Step Challenge",
      );
      fireEvent.changeText(titleInput, "My Custom Challenge");

      const goalInput = screen.getByPlaceholderText("e.g., 10000");
      fireEvent.changeText(goalInput, "100");

      // Fill in unit but not activity name
      const unitInput = screen.getByPlaceholderText("e.g., reps, minutes");
      fireEvent.changeText(unitInput, "sessions");

      const createButtons = screen.getAllByText("Create Challenge");
      const createButton = createButtons[createButtons.length - 1];
      fireEvent.press(createButton);

      expect(
        screen.getByText("Please enter a custom activity name"),
      ).toBeTruthy();
    });

    it("shows error when duration is invalid", async () => {
      render(<CreateChallengeScreen />);

      // Fill in title and goal
      const titleInput = screen.getByPlaceholderText(
        "e.g., Summer Step Challenge",
      );
      fireEvent.changeText(titleInput, "My Challenge");

      const goalInput = screen.getByPlaceholderText("e.g., 10000");
      fireEvent.changeText(goalInput, "50000");

      // Select custom duration and enter invalid value
      fireEvent.press(getNthByText("Custom", 2));

      const durationInput = screen.getByPlaceholderText("Number of days");
      fireEvent.changeText(durationInput, "0");

      const createButtons = screen.getAllByText("Create Challenge");
      const createButton = createButtons[createButtons.length - 1];
      fireEvent.press(createButton);

      expect(
        screen.getByText("Duration must be between 1 and 365 days"),
      ).toBeTruthy();
    });
  });

  describe("Challenge Creation", () => {
    it("calls createChallenge mutation with correct data", async () => {
      mockChallengesState.createChallenge.mutateAsync.mockResolvedValue({
        id: "new-challenge-123",
      });

      render(<CreateChallengeScreen />);

      // Fill in valid form
      const titleInput = screen.getByPlaceholderText(
        "e.g., Summer Step Challenge",
      );
      fireEvent.changeText(titleInput, "My Step Challenge");

      const goalInput = screen.getByPlaceholderText("e.g., 10000");
      fireEvent.changeText(goalInput, "70000");

      // Submit
      const createButtons = screen.getAllByText("Create Challenge");
      const createButton = createButtons[createButtons.length - 1];
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(
          mockChallengesState.createChallenge.mutateAsync,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "My Step Challenge",
            challenge_type: "steps",
            goal_value: 70000,
            goal_unit: "steps",
            win_condition: "highest_total",
          }),
        );
      });
    });

    it("shows success alert on successful creation", async () => {
      mockChallengesState.createChallenge.mutateAsync.mockResolvedValue({
        id: "new-challenge-123",
      });

      render(<CreateChallengeScreen />);

      // Fill in valid form
      const titleInput = screen.getByPlaceholderText(
        "e.g., Summer Step Challenge",
      );
      fireEvent.changeText(titleInput, "My Step Challenge");

      const goalInput = screen.getByPlaceholderText("e.g., 10000");
      fireEvent.changeText(goalInput, "70000");

      // Submit
      const createButtons = screen.getAllByText("Create Challenge");
      const createButton = createButtons[createButtons.length - 1];
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Challenge Created! 🎉",
          expect.stringContaining("Your challenge is ready"),
          expect.any(Array),
        );
      });
    });

    it("shows error message on creation failure", async () => {
      mockChallengesState.createChallenge.mutateAsync.mockRejectedValue(
        new Error("Network error"),
      );

      render(<CreateChallengeScreen />);

      // Fill in valid form
      const titleInput = screen.getByPlaceholderText(
        "e.g., Summer Step Challenge",
      );
      fireEvent.changeText(titleInput, "My Step Challenge");

      const goalInput = screen.getByPlaceholderText("e.g., 10000");
      fireEvent.changeText(goalInput, "70000");

      // Submit
      const createButtons = screen.getAllByText("Create Challenge");
      const createButton = createButtons[createButtons.length - 1];
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeTruthy();
      });
    });

    it("shows loading state while creating", async () => {
      mockChallengesState.createChallenge.isPending = true;

      render(<CreateChallengeScreen />);

      expect(screen.getByText("Creating...")).toBeTruthy();
    });
  });

  describe("Summary Card", () => {
    it("updates summary when form values change", () => {
      render(<CreateChallengeScreen />);

      const titleInput = screen.getByPlaceholderText(
        "e.g., Summer Step Challenge",
      );
      fireEvent.changeText(titleInput, "Weekly Run");

      const goalInput = screen.getByPlaceholderText("e.g., 10000");
      fireEvent.changeText(goalInput, "50");

      // Summary should contain the entered values
      expect(screen.getByText(/Weekly Run/)).toBeTruthy();
      expect(screen.getByText(/50/)).toBeTruthy();
    });

    it("shows start time info in summary", () => {
      render(<CreateChallengeScreen />);

      expect(screen.getByText("Starts:")).toBeTruthy();
      expect(screen.getByText("Ends:")).toBeTruthy();
    });
  });
});
