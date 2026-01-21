// src/__tests__/component/jest.setup.ts
// Jest setup for component tests - configures RNTL and common mocks

import "@testing-library/jest-native/extend-expect";

// =============================================================================
// EXPO/RN MODULE MOCKS
// =============================================================================

// Mock expo-linear-gradient
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children: any }) => children,
}));

// Mock react-native-heroicons
jest.mock("react-native-heroicons/outline", () => ({
  ChevronLeftIcon: () => null,
  PlusIcon: () => null,
  XMarkIcon: () => null,
  MagnifyingGlassIcon: () => null,
  UserPlusIcon: () => null,
  TrophyIcon: () => null,
  FireIcon: () => null,
  ClockIcon: () => null,
  CheckCircleIcon: () => null,
  ExclamationCircleIcon: () => null,
}));

jest.mock("react-native-heroicons/solid", () => ({
  ChevronLeftIcon: () => null,
  PlusIcon: () => null,
  TrophyIcon: () => null,
  FireIcon: () => null,
}));

// =============================================================================
// EXPO ROUTER MOCKS
// =============================================================================

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
  setParams: jest.fn(),
};

const mockSearchParams: Record<string, string> = {};

jest.mock("expo-router", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    router: mockRouter,
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockSearchParams,
    useSegments: () => [],
    Link: ({
      children,
      href,
      asChild,
    }: {
      children: any;
      href: string;
      asChild?: boolean;
    }) => {
      if (asChild) {
        return children;
      }
      // Use createElement instead of JSX since this is a .ts file
      return React.createElement(View, { testID: `link-${href}` }, children);
    },
    Redirect: () => null,
  };
});

// Export for test customization
export { mockRouter, mockSearchParams };

// =============================================================================
// AUTH MOCK
// =============================================================================

const mockAuthState = {
  session: null,
  user: null,
  profile: null,
  loading: false,
  error: null,
  pendingEmailConfirmation: false,
  signUp: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  refreshProfile: jest.fn(),
  clearError: jest.fn(),
};

jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockAuthState,
}));

jest.mock("@/providers/AuthProvider", () => ({
  useAuth: () => mockAuthState,
  AuthProvider: ({ children }: { children: any }) => children,
}));

// Export for test customization
export { mockAuthState };

// =============================================================================
// THEME MOCK
// =============================================================================

const mockTheme = {
  colors: {
    primary: {
      main: "#00D26A",
      dark: "#00B85C",
      light: "#33DB88",
      subtle: "#E6FBF0",
      contrast: "#FFFFFF",
    },
    energy: {
      main: "#FF6B35",
      dark: "#E55A2B",
      light: "#FF8A5C",
      subtle: "#FFF0EB",
      contrast: "#FFFFFF",
    },
    achievement: {
      main: "#FFD700",
      dark: "#E5C200",
      light: "#FFDF33",
      subtle: "#FFFBEB",
      contrast: "#1A1A1A",
    },
    success: "#00D26A",
    warning: "#FFB800",
    error: "#FF4757",
    info: "#3B82F6",
    background: "#FFFFFF",
    surface: "#F8F9FA",
    surfaceElevated: "#FFFFFF",
    surfacePressed: "#F0F0F0",
    border: "#E5E5E5",
    borderStrong: "#D0D0D0",
    borderFocus: "#00D26A",
    textPrimary: "#1A1A1A",
    textSecondary: "#6B7280",
    textMuted: "#9CA3AF",
    textInverse: "#FFFFFF",
    overlay: "rgba(0, 0, 0, 0.5)",
    scrim: "rgba(0, 0, 0, 0.3)",
  },
  shadows: {
    none: "none",
    sm: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    card: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    elevated: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 5,
    },
    button: {
      shadowColor: "#00D26A",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    modal: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 24,
      elevation: 8,
    },
    float: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.2,
      shadowRadius: 32,
      elevation: 12,
    },
  },
  typography: {
    fontFamily: {
      regular: "PlusJakartaSans_400Regular",
      medium: "PlusJakartaSans_500Medium",
      semiBold: "PlusJakartaSans_600SemiBold",
      bold: "PlusJakartaSans_700Bold",
    },
    fontSize: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      "2xl": 24,
      "3xl": 30,
      "4xl": 36,
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    "2xl": 32,
    "3xl": 48,
    "4xl": 64,
  },
  radius: {
    none: 0,
    sm: 4,
    base: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
    card: 16,
    cardInner: 12,
    button: 12,
    input: 10,
    avatar: 9999,
    badge: 6,
    modal: 20,
  },
  animation: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
  zIndex: {
    base: 0,
    dropdown: 10,
    sticky: 20,
    modal: 30,
    toast: 40,
  },
  breakpoints: {
    sm: 640,
    md: 768,
    lg: 1024,
  },
  iconSize: {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
  },
  componentSize: {
    buttonHeight: 48,
    inputHeight: 48,
    avatarSm: 32,
    avatarMd: 40,
    avatarLg: 56,
    tabBarHeight: 64,
    headerHeight: 56,
  },
  isDark: false,
  fontsLoaded: true,
};

jest.mock("@/providers/ThemeProvider", () => ({
  useAppTheme: () => mockTheme,
  ThemeProvider: ({ children }: { children: any }) => children,
}));

// Export for test customization
export { mockTheme };

// =============================================================================
// GLOBAL TEST UTILITIES
// =============================================================================

// Reset all mocks between tests
beforeEach(() => {
  jest.clearAllMocks();

  // Reset auth state to defaults
  mockAuthState.session = null;
  mockAuthState.user = null;
  mockAuthState.profile = null;
  mockAuthState.loading = false;
  mockAuthState.error = null;
  mockAuthState.pendingEmailConfirmation = false;
});

// Silence console.error for expected errors in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    // Filter out React Native expected warnings
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Warning:") || args[0].includes("React Native"))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
