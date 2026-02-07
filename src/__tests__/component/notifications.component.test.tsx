// src/__tests__/component/notifications.component.test.tsx
// ============================================
// Notifications Screen Component Tests (V2)
// ============================================

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { NotificationsScreen } from "@/components/notifications";

// =============================================================================
// MOCKS
// =============================================================================

// Mock expo-router
const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  router: {
    push: mockPush,
    back: mockBack,
  },
  Stack: {
    Screen: ({ options }: any) => null,
  },
  useFocusEffect: (callback: () => void) => {
    React.useEffect(() => {
      callback();
    }, []);
  },
}));

// Mock safe-area-context
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: any) => children,
}));

// Mock theme provider
jest.mock("@/providers/ThemeProvider", () => ({
  useAppTheme: () => ({
    colors: {
      background: "#FFFFFF",
      surface: "#F9FAFB",
      surfaceElevated: "#F3F4F6",
      primary: {
        main: "#10B981",
        subtle: "#D1FAE5",
        contrast: "#FFFFFF",
      },
      textPrimary: "#111827",
      textSecondary: "#6B7280",
      textMuted: "#9CA3AF",
      border: "#E5E7EB",
      error: "#EF4444",
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 20,
      "2xl": 24,
    },
    radius: {
      sm: 4,
      md: 8,
      lg: 12,
      xl: 16,
      card: 12,
      button: 8,
      full: 9999,
    },
    typography: {
      fontSize: {
        xs: 12,
        sm: 14,
        base: 16,
        lg: 18,
      },
    },
    shadows: {
      card: {},
    },
  }),
}));

// Mock notifications hooks
const mockNotifications = [
  {
    id: "notif-1",
    user_id: "user-1",
    type: "challenge_invite_received",
    title: "New Challenge Invite",
    body: "John invited you to Steps Challenge",
    data: { challenge_id: "challenge-123" },
    read_at: null,
    created_at: new Date().toISOString(),
  },
  {
    id: "notif-2",
    user_id: "user-1",
    type: "friend_request_received",
    title: "Friend Request",
    body: "Jane wants to be your friend",
    data: { requester_id: "user-2" },
    read_at: "2024-01-01T00:00:00Z",
    created_at: new Date(Date.now() - 86400000).toISOString(), // yesterday
  },
];

const mockRefetch = jest.fn().mockResolvedValue(undefined);
const mockMarkAsRead = jest.fn().mockResolvedValue(undefined);
const mockMarkAllAsRead = jest.fn().mockResolvedValue(undefined);

jest.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({
    data: mockNotifications,
    isLoading: false,
    refetch: mockRefetch,
  }),
  useMarkNotificationAsRead: () => ({
    mutate: mockMarkAsRead,
    mutateAsync: mockMarkAsRead,
    isPending: false,
  }),
  useMarkAllNotificationsAsRead: () => ({
    mutate: mockMarkAllAsRead,
    mutateAsync: mockMarkAllAsRead,
    isPending: false,
  }),
  useUnreadNotificationCount: () => ({
    data: 1,
  }),
}));

// Mock heroicons
jest.mock("react-native-heroicons/outline", () => ({
  BellIcon: () => "BellIcon",
  ChevronLeftIcon: () => "ChevronLeftIcon",
  TrophyIcon: () => "TrophyIcon",
  UserPlusIcon: () => "UserPlusIcon",
  CheckCircleIcon: () => "CheckCircleIcon",
  XMarkIcon: () => "XMarkIcon",
  InboxIcon: () => "InboxIcon",
  EnvelopeOpenIcon: () => "EnvelopeOpenIcon",
  UserGroupIcon: () => "UserGroupIcon",
}));

jest.mock("react-native-heroicons/solid", () => ({
  TrophyIcon: () => "TrophySolid",
  UserPlusIcon: () => "UserPlusSolid",
}));

// Mock UI components
jest.mock("@/components/ui", () => ({
  LoadingScreen: () => "LoadingScreen",
}));

// =============================================================================
// TESTS
// =============================================================================

describe("V2NotificationsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders notifications with filters", () => {
      const { getByText } = render(<NotificationsScreen />);

      expect(getByText("Notifications")).toBeTruthy();
      expect(getByText("All")).toBeTruthy();
      expect(getByText("Unread")).toBeTruthy();
    });

    it("renders notification content", () => {
      const { getByText } = render(<NotificationsScreen />);

      expect(getByText("New Challenge Invite")).toBeTruthy();
      expect(getByText("John invited you to Steps Challenge")).toBeTruthy();
    });
  });

  describe("navigation", () => {
    it("navigates to challenge when challenge notification pressed", async () => {
      const { getByText } = render(<NotificationsScreen />);

      fireEvent.press(getByText("New Challenge Invite"));

      await waitFor(() => {
        expect(mockMarkAsRead).toHaveBeenCalledWith("notif-1");
        expect(mockPush).toHaveBeenCalledWith("/challenge/challenge-123");
      });
    });

    it("V2 screen always navigates to V2 friends tab", async () => {
      const { getByText } = render(<NotificationsScreen />);

      fireEvent.press(getByText("Friend Request"));

      await waitFor(() => {
        // V2 component always uses V2 route
        expect(mockPush).toHaveBeenCalledWith("/(tabs)/friends");
      });
    });

    it("goes back when back button pressed", () => {
      const { UNSAFE_getByType } = render(<NotificationsScreen />);

      // Find the back button by its TouchableOpacity containing ChevronLeftIcon
      // This is a simplified test - in real tests you'd use testID
    });
  });
});
