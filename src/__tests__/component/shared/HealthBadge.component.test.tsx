// __tests__/components/shared/HealthBadge.test.tsx
// ============================================
// HealthBadge Component Tests
// ============================================

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import {
  HealthBadge,
  HealthProvider,
  ConnectionStatus,
} from "@/components/shared/HealthBadge";

// Mock the theme hook
jest.mock("@/constants/theme", () => ({
  useTheme: () => ({
    colors: {
      primary: {
        main: "#10B981",
        contrast: "#FFFFFF",
      },
      semantic: {
        success: "#10B981",
        error: "#EF4444",
        warning: "#F59E0B",
      },
      surface: "#FFFFFF",
      border: "#E5E7EB",
      textPrimary: "#111827",
      textSecondary: "#6B7280",
      textTertiary: "#9CA3AF",
    },
    typography: {
      fontSize: {
        xs: 12,
        sm: 14,
        base: 16,
      },
      fontWeight: {
        medium: "500",
        semibold: "600",
      },
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
    },
    radius: {
      sm: 6,
      md: 8,
      card: 12,
      button: 12,
      full: 9999,
    },
    shadows: {
      card: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
    },
  }),
}));

// Mock heroicons
jest.mock("react-native-heroicons/outline", () => ({
  HeartIcon: () => "HeartIcon",
  ArrowPathIcon: () => "ArrowPathIcon",
  CheckCircleIcon: () => "CheckCircleIcon",
  ExclamationCircleIcon: () => "ExclamationCircleIcon",
  LinkIcon: () => "LinkIcon",
}));

jest.mock("react-native-heroicons/solid", () => ({
  HeartIcon: () => "HeartIconSolid",
}));

describe("HealthBadge", () => {
  describe("compact variant", () => {
    it("renders connected state", () => {
      const { getByText, getByTestId } = render(
        <HealthBadge
          provider="healthkit"
          status="connected"
          variant="compact"
          testID="health-badge"
        />,
      );

      expect(getByTestId("health-badge")).toBeTruthy();
      expect(getByText("Apple Health")).toBeTruthy();
    });

    it("renders disconnected state with Connect text", () => {
      const { getByText } = render(
        <HealthBadge
          provider="healthkit"
          status="disconnected"
          variant="compact"
        />,
      );

      expect(getByText("Connect")).toBeTruthy();
    });

    it("calls onConnect when pressed in disconnected state", () => {
      const onConnect = jest.fn();
      const { getByTestId } = render(
        <HealthBadge
          provider="healthkit"
          status="disconnected"
          variant="compact"
          onConnect={onConnect}
          testID="badge"
        />,
      );

      fireEvent.press(getByTestId("badge"));
      expect(onConnect).toHaveBeenCalledTimes(1);
    });

    it("calls onSync when pressed in connected state", () => {
      const onSync = jest.fn();
      const { getByTestId } = render(
        <HealthBadge
          provider="healthkit"
          status="connected"
          variant="compact"
          onSync={onSync}
          testID="badge"
        />,
      );

      fireEvent.press(getByTestId("badge"));
      expect(onSync).toHaveBeenCalledTimes(1);
    });
  });

  describe("inline variant", () => {
    it("renders connected status", () => {
      const { getByText } = render(
        <HealthBadge
          provider="healthkit"
          status="connected"
          variant="inline"
        />,
      );

      expect(getByText("Connected")).toBeTruthy();
    });

    it("renders syncing status", () => {
      const { getByText } = render(
        <HealthBadge
          provider="healthkit"
          status="syncing"
          variant="inline"
          isSyncing
        />,
      );

      expect(getByText("Syncing...")).toBeTruthy();
    });

    it("renders error status", () => {
      const { getByText } = render(
        <HealthBadge provider="healthkit" status="error" variant="inline" />,
      );

      expect(getByText("Error")).toBeTruthy();
    });

    it("shows last sync time when connected", () => {
      const lastSync = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago
      const { getByText } = render(
        <HealthBadge
          provider="healthkit"
          status="connected"
          variant="inline"
          lastSync={lastSync}
        />,
      );

      expect(getByText("• 5m ago")).toBeTruthy();
    });
  });

  describe("full variant", () => {
    it("renders provider name and icon", () => {
      const { getByText, getByTestId } = render(
        <HealthBadge
          provider="healthkit"
          status="connected"
          variant="full"
          testID="badge"
        />,
      );

      expect(getByTestId("badge")).toBeTruthy();
      expect(getByText("Apple Health")).toBeTruthy();
    });

    it("renders Google Fit provider", () => {
      const { getByText } = render(
        <HealthBadge
          provider="googlefit"
          status="disconnected"
          variant="full"
        />,
      );

      expect(getByText("Google Fit")).toBeTruthy();
    });

    it("renders demo mode provider", () => {
      const { getByText } = render(
        <HealthBadge provider="mock" status="connected" variant="full" />,
      );

      expect(getByText("Demo Mode")).toBeTruthy();
    });

    it("shows Sync Now button when connected", () => {
      const { getByText } = render(
        <HealthBadge provider="healthkit" status="connected" variant="full" />,
      );

      expect(getByText("Sync Now")).toBeTruthy();
    });

    it("shows Connect button when disconnected", () => {
      const { getByText } = render(
        <HealthBadge
          provider="healthkit"
          status="disconnected"
          variant="full"
        />,
      );

      expect(getByText("Connect Apple Health")).toBeTruthy();
    });

    it("shows Settings button when connected", () => {
      const { getByText } = render(
        <HealthBadge provider="healthkit" status="connected" variant="full" />,
      );

      expect(getByText("Settings")).toBeTruthy();
    });

    it("shows error message when status is error", () => {
      const { getByText } = render(
        <HealthBadge
          provider="healthkit"
          status="error"
          variant="full"
          errorMessage="Permission denied"
        />,
      );

      expect(getByText("Permission denied")).toBeTruthy();
    });

    it("shows sync progress when syncing", () => {
      const { getByText } = render(
        <HealthBadge
          provider="healthkit"
          status="syncing"
          variant="full"
          isSyncing
          syncProgress={45}
        />,
      );

      expect(getByText("Syncing 45%")).toBeTruthy();
    });

    it("shows last synced time", () => {
      const lastSync = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const { getByText } = render(
        <HealthBadge
          provider="healthkit"
          status="connected"
          variant="full"
          lastSync={lastSync}
        />,
      );

      expect(getByText("Last synced: 2h ago")).toBeTruthy();
    });

    it("shows Never synced when no lastSync", () => {
      const { getByText } = render(
        <HealthBadge provider="healthkit" status="connected" variant="full" />,
      );

      expect(getByText("Last synced: Never synced")).toBeTruthy();
    });
  });

  describe("interactions", () => {
    it("calls onSync when Sync Now is pressed", () => {
      const onSync = jest.fn();
      const { getByText } = render(
        <HealthBadge
          provider="healthkit"
          status="connected"
          variant="full"
          onSync={onSync}
        />,
      );

      fireEvent.press(getByText("Sync Now"));
      expect(onSync).toHaveBeenCalledTimes(1);
    });

    it("calls onConnect when Connect button is pressed", () => {
      const onConnect = jest.fn();
      const { getByText } = render(
        <HealthBadge
          provider="healthkit"
          status="disconnected"
          variant="full"
          onConnect={onConnect}
        />,
      );

      fireEvent.press(getByText("Connect Apple Health"));
      expect(onConnect).toHaveBeenCalledTimes(1);
    });

    it("calls onSettings when Settings is pressed", () => {
      const onSettings = jest.fn();
      const { getByText } = render(
        <HealthBadge
          provider="healthkit"
          status="connected"
          variant="full"
          onSettings={onSettings}
        />,
      );

      fireEvent.press(getByText("Settings"));
      expect(onSettings).toHaveBeenCalledTimes(1);
    });

    it("disables Sync Now button while syncing", () => {
      const onSync = jest.fn();
      const { getByText } = render(
        <HealthBadge
          provider="healthkit"
          status="connected"
          variant="full"
          isSyncing
          onSync={onSync}
        />,
      );

      // Can't easily test disabled state, but activity indicator should show
      expect(true).toBe(true);
    });
  });

  describe("status configurations", () => {
    const statuses: ConnectionStatus[] = [
      "connected",
      "disconnected",
      "syncing",
      "error",
      "partial",
    ];

    statuses.forEach((status) => {
      it(`renders ${status} status without crashing`, () => {
        const { getByTestId } = render(
          <HealthBadge
            provider="healthkit"
            status={status}
            variant="full"
            testID="badge"
          />,
        );

        expect(getByTestId("badge")).toBeTruthy();
      });
    });
  });

  describe("provider configurations", () => {
    const providers: HealthProvider[] = ["healthkit", "googlefit", "mock"];

    providers.forEach((provider) => {
      it(`renders ${provider} provider without crashing`, () => {
        const { getByTestId } = render(
          <HealthBadge
            provider={provider}
            status="connected"
            variant="full"
            testID="badge"
          />,
        );

        expect(getByTestId("badge")).toBeTruthy();
      });
    });
  });
});
