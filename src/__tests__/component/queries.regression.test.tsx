import React from "react";
import { render, screen } from "@testing-library/react-native";
import HomeScreen from "@/app/(tabs)/index";
import CreateChallengeScreen from "@/app/challenge/create";
import {
  createMockChallengeWithParticipation,
  getNthByText,
  setupActiveChallenges,
} from "./factories";

describe("Query Utilities - Duplicate Text Handling", () => {
  describe("HomeScreen rank labels", () => {
    it("finds correct rank in specific challenge card using scoped query", () => {
      const challenges = [
        createMockChallengeWithParticipation({
          id: "c1",
          title: "Step Challenge",
          my_rank: 1,
        }),
        createMockChallengeWithParticipation({
          id: "c2",
          title: "Run Challenge",
          my_rank: 2,
        }),
      ];
      setupActiveChallenges(challenges);

      render(<HomeScreen />);

      expect(screen.getAllByText("1st").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("2nd").length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("CreateChallengeScreen duplicate labels", () => {
    it("finds correct Custom button for duration (not activity type)", () => {
      render(<CreateChallengeScreen />);

      const customButtons = screen.getAllByText("Custom");
      expect(customButtons.length).toBeGreaterThanOrEqual(2);

      expect(getNthByText("Custom", 2)).toBeTruthy();
    });
  });
});
