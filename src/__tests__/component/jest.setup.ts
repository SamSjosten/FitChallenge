// src/__tests__/component/jest.setup.ts
// Jest setup for component tests - configures RNTL and common mocks

// =============================================================================
// REACT-NATIVE-REANIMATED MOCK (must be before other imports)
// =============================================================================

jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { View, Text } = require("react-native");

  const AnimatedView = ({ children, style, ...props }: any) =>
    React.createElement(View, { ...props, style }, children);
  const AnimatedText = ({ children, style, ...props }: any) =>
    React.createElement(Text, { ...props, style }, children);

  return {
    __esModule: true,
    default: {
      call: () => {},
      createAnimatedComponent: (component: any) => component,
      addWhitelistedNativeProps: () => {},
      View: AnimatedView,
      Text: AnimatedText,
    },
    View: AnimatedView,
    Text: AnimatedText,
    useSharedValue: (init: any) => ({ value: init }),
    useAnimatedStyle: () => ({}),
    useDerivedValue: (fn: () => any) => ({ value: fn() }),
    useAnimatedProps: () => ({}),
    withTiming: (val: any, _config?: any, callback?: any) => {
      // Execute callback synchronously for testing
      if (callback) callback(true);
      return val;
    },
    withSpring: (val: any, _config?: any, callback?: any) => {
      if (callback) callback(true);
      return val;
    },
    withSequence: (...args: any[]) => args[args.length - 1],
    withDelay: (_: number, val: any) => val,
    withRepeat: (val: any) => val,
    Easing: {
      linear: (t: number) => t,
      ease: (t: number) => t,
      bezier: () => (t: number) => t,
      in: (fn: any) => fn,
      out: (fn: any) => fn,
      inOut: (fn: any) => fn,
    },
    FadeIn: { duration: () => ({ build: () => ({}) }) },
    FadeOut: { duration: () => ({ build: () => ({}) }) },
    FadeInDown: { duration: () => ({ springify: () => ({}) }) },
    FadeInUp: { duration: () => ({ springify: () => ({}) }) },
    SlideInRight: { duration: () => ({ build: () => ({}) }) },
    SlideOutLeft: { duration: () => ({ build: () => ({}) }) },
    Layout: { duration: () => ({ build: () => ({}) }) },
    runOnJS: (fn: Function) => fn,
    runOnUI: (fn: Function) => fn,
    interpolate: (val: number) => val,
    Extrapolate: { CLAMP: "clamp", EXTEND: "extend" },
    createAnimatedComponent: (comp: any) => comp,
    useReducedMotion: () => false,
    ReduceMotion: { Never: 0, Always: 1, System: 2 },
  };
});

// =============================================================================
// EXPO WINTER RUNTIME POLYFILLS
// =============================================================================

if (typeof globalThis.structuredClone === "undefined") {
  (globalThis as any).structuredClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));
}

if (typeof (globalThis as any).__ExpoImportMetaRegistry === "undefined") {
  (globalThis as any).__ExpoImportMetaRegistry = {
    url: "http://localhost:8081",
  };
}

jest.mock("expo/src/winter/runtime.native", () => ({}), { virtual: true });
jest.mock(
  "expo/src/winter/installGlobal",
  () => ({
    installGlobal: () => {},
    default: () => {},
  }),
  { virtual: true },
);

import "@testing-library/jest-native/extend-expect";

// =============================================================================
// EXPO/RN MODULE MOCKS
// =============================================================================

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LinearGradient: ({ children, ...props }: any) =>
      React.createElement(View, { ...props, testID: "linear-gradient" }, children),
  };
});

jest.mock("react-native-heroicons/outline", () => ({
  ChevronLeftIcon: () => null,
  ChevronRightIcon: () => null,
  ChevronDownIcon: () => null,
  PlusIcon: () => null,
  XMarkIcon: () => null,
  MagnifyingGlassIcon: () => null,
  UserPlusIcon: () => null,
  TrophyIcon: () => null,
  FireIcon: () => null,
  ClockIcon: () => null,
  CheckIcon: () => null,
  CheckCircleIcon: () => null,
  ExclamationCircleIcon: () => null,
  ExclamationTriangleIcon: () => null,
  InformationCircleIcon: () => null,
  ArrowTrendingUpIcon: () => null,
  MapPinIcon: () => null,
  HeartIcon: () => null,
  BoltIcon: () => null,
  FunnelIcon: () => null,
}));

jest.mock("react-native-heroicons/solid", () => ({
  ChevronLeftIcon: () => null,
  PlusIcon: () => null,
  TrophyIcon: () => null,
  FireIcon: () => null,
  CheckCircleIcon: () => null,
  DevicePhoneMobileIcon: () => null,
}));

jest.mock("react-native-svg", () => {
  const React = require("react");
  const { View } = require("react-native");

  // Create proper function components that can be wrapped by createAnimatedComponent
  const Svg = React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement(View, { ...props, ref }, children),
  );
  const Circle = React.forwardRef((props: any, ref: any) =>
    React.createElement(View, { ...props, ref }),
  );
  const Rect = React.forwardRef((props: any, ref: any) =>
    React.createElement(View, { ...props, ref }),
  );
  const Path = React.forwardRef((props: any, ref: any) =>
    React.createElement(View, { ...props, ref }),
  );
  const G = React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement(View, { ...props, ref }, children),
  );

  return {
    __esModule: true,
    default: Svg,
    Svg,
    Circle,
    Rect,
    Path,
    G,
    Defs: ({ children }: any) => children,
    LinearGradient: ({ children }: any) => children,
    Stop: () => null,
  };
});

jest.mock("@react-native-community/datetimepicker", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ testID }: { testID?: string }) =>
      React.createElement(View, { testID: testID || "date-time-picker" }),
  };
});

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
    useFocusEffect: (callback: () => void) => {
      const React = require("react");
      React.useEffect(() => {
        callback();
      }, []);
    },
    Link: ({ children, href, asChild }: { children: any; href: string; asChild?: boolean }) => {
      if (asChild) {
        return children;
      }
      return React.createElement(View, { testID: `link-${href}` }, children);
    },
    Redirect: () => null,
  };
});

export { mockRouter, mockSearchParams };

// =============================================================================
// THEME MOCK
// =============================================================================

const mockTheme = {
  colors: {
    primary: {
      main: "#10B981",
      dark: "#059669",
      light: "#34D399",
      subtle: "#D1FAE5",
      contrast: "#FFFFFF",
    },
    energy: {
      main: "#F59E0B",
      dark: "#D97706",
      light: "#FCD34D",
      subtle: "#FEF3C7",
      contrast: "#FFFFFF",
    },
    achievement: {
      main: "#8B5CF6",
      dark: "#7C3AED",
      light: "#A78BFA",
      subtle: "#EDE9FE",
      contrast: "#FFFFFF",
    },
    social: {
      main: "#3B82F6",
      dark: "#2563EB",
      light: "#60A5FA",
      subtle: "#DBEAFE",
      contrast: "#FFFFFF",
    },
    success: "#10B981",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#3B82F6",
    background: "#FFFFFF",
    surface: "#F9FAFB",
    surfaceElevated: "#FFFFFF",
    surfacePressed: "#F3F4F6",
    border: "#E5E7EB",
    borderStrong: "#D1D5DB",
    borderFocus: "#10B981",
    textPrimary: "#111827",
    textSecondary: "#6B7280",
    textMuted: "#9CA3AF",
    textInverse: "#FFFFFF",
    overlay: "rgba(0, 0, 0, 0.5)",
    scrim: "rgba(0, 0, 0, 0.3)",
  },
  shadows: {
    none: {},
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
      shadowColor: "#10B981",
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
    fontWeight: {
      regular: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
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
    textStyles: {
      title: { fontSize: 20 },
      body: { fontSize: 16 },
      caption: { fontSize: 12 },
      label: { fontSize: 14 },
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

export { mockTheme };

// =============================================================================
// THEME MOCKS (both providers)
// =============================================================================

jest.mock("@/providers/ThemeProvider", () => ({
  useAppTheme: () => mockTheme,
  ThemeProvider: ({ children }: { children: any }) => children,
}));

jest.mock("@/constants/theme", () => ({
  useTheme: () => mockTheme,
  colors: {
    light: mockTheme.colors,
    dark: mockTheme.colors,
  },
  typography: mockTheme.typography,
  spacing: mockTheme.spacing,
  radius: mockTheme.radius,
  shadows: { light: mockTheme.shadows, dark: mockTheme.shadows },
  animation: mockTheme.animation,
  zIndex: mockTheme.zIndex,
  iconSize: mockTheme.iconSize,
  componentSize: mockTheme.componentSize,
  theme: mockTheme,
}));

// =============================================================================
// AUTH MOCK
// =============================================================================

const mockAuthState = {
  session: null as any,
  user: null as any,
  profile: null as any,
  loading: false,
  error: null as any,
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

export { mockAuthState };

// =============================================================================
// CHALLENGES HOOKS MOCK
// =============================================================================

const mockChallengesState = {
  activeChallenges: {
    data: [] as any[],
    isLoading: false,
    error: null as any,
    refetch: jest.fn(),
  },
  completedChallenges: {
    data: [] as any[],
    isLoading: false,
    error: null as any,
    refetch: jest.fn(),
  },
  pendingInvites: {
    data: [] as any[],
    isLoading: false,
    error: null as any,
    refetch: jest.fn(),
  },
  challenge: {
    data: null as any,
    isLoading: false,
    error: null as any,
    refetch: jest.fn(),
  },
  leaderboard: {
    data: [] as any[],
    isLoading: false,
    error: null as any,
    refetch: jest.fn(),
  },
  respondToInvite: {
    mutateAsync: jest.fn(),
    isPending: false,
  },
  createChallenge: {
    mutateAsync: jest.fn(),
    isPending: false,
  },
  logActivity: {
    mutateAsync: jest.fn(),
    isPending: false,
  },
  inviteUser: {
    mutateAsync: jest.fn(),
    isPending: false,
  },
  leaveChallenge: {
    mutateAsync: jest.fn(),
    isPending: false,
  },
  cancelChallenge: {
    mutateAsync: jest.fn(),
    isPending: false,
  },
};

jest.mock("@/hooks/useChallenges", () => ({
  useActiveChallenges: () => mockChallengesState.activeChallenges,
  useCompletedChallenges: () => mockChallengesState.completedChallenges,
  usePendingInvites: () => mockChallengesState.pendingInvites,
  useChallenge: () => mockChallengesState.challenge,
  useLeaderboard: () => mockChallengesState.leaderboard,
  useRespondToInvite: () => mockChallengesState.respondToInvite,
  useCreateChallenge: () => mockChallengesState.createChallenge,
  useLogActivity: () => mockChallengesState.logActivity,
  useInviteUser: () => mockChallengesState.inviteUser,
  useLeaveChallenge: () => mockChallengesState.leaveChallenge,
  useCancelChallenge: () => mockChallengesState.cancelChallenge,
}));

export { mockChallengesState };

// =============================================================================
// REALTIME SUBSCRIPTION MOCK
// =============================================================================

jest.mock("@/hooks/useRealtimeSubscription", () => ({
  useLeaderboardSubscription: jest.fn(),
}));

// =============================================================================
// SERVICES MOCKS
// =============================================================================

jest.mock("@/services/pushTokens", () => ({
  pushTokenService: {
    requestAndRegister: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("@/services/activities", () => ({
  generateClientEventId: jest.fn(() => "mock-client-event-id-12345"),
}));

jest.mock("@/services/auth", () => ({
  authService: {
    searchUsers: jest.fn().mockResolvedValue([]),
  },
}));

// =============================================================================
// LIB MOCKS
// =============================================================================

jest.mock("@/lib/serverTime", () => ({
  getServerNow: jest.fn(() => new Date("2025-01-15T12:00:00Z")),
  syncServerTime: jest.fn().mockResolvedValue(undefined),
  getDaysRemaining: jest.fn(() => 7),
}));

export const mockChallengeStatus = {
  effectiveStatus: "active" as string,
  canLog: true,
};

jest.mock("@/lib/challengeStatus", () => ({
  getEffectiveStatus: jest.fn(() => mockChallengeStatus.effectiveStatus),
  canLogActivity: jest.fn(() => mockChallengeStatus.canLog),
  getStatusLabel: jest.fn((status: string) => {
    switch (status) {
      case "upcoming":
        return "Starting Soon";
      case "active":
        return "Active";
      case "completed":
        return "Completed";
      default:
        return "Active";
    }
  }),
  getStatusColor: jest.fn(() => "#34C759"),
}));

// =============================================================================
// UI COMPONENTS MOCKS
// =============================================================================

jest.mock("@/components/ui", () => {
  const React = require("react");
  const { View, Text, ActivityIndicator } = require("react-native");

  return {
    ScreenContainer: ({ children, header }: { children: any; header?: any }) =>
      React.createElement(View, { testID: "screen-container" }, header, children),
    ScreenHeader: ({ title, subtitle }: { title: string; subtitle?: string }) =>
      React.createElement(
        View,
        { testID: "screen-header" },
        React.createElement(Text, {}, title),
        subtitle && React.createElement(Text, {}, subtitle),
      ),
    ScreenSection: ({ children }: { children: any }) =>
      React.createElement(View, { testID: "screen-section" }, children),
    Card: ({ children }: { children: any }) =>
      React.createElement(View, { testID: "card" }, children),
    LoadingScreen: () =>
      React.createElement(
        View,
        { testID: "loading-screen" },
        React.createElement(ActivityIndicator),
      ),
    Badge: ({ children }: { children: any }) =>
      React.createElement(View, { testID: "badge" }, children),
    ProgressBar: ({ progress }: { progress: number }) =>
      React.createElement(View, {
        testID: "progress-bar",
        accessibilityValue: { now: progress },
      }),
    ErrorMessage: ({ message, onRetry }: { message: string; onRetry?: () => void }) =>
      React.createElement(
        View,
        { testID: "error-message" },
        React.createElement(Text, {}, message),
      ),
    EmptyState: ({ message }: { message: string }) =>
      React.createElement(View, { testID: "empty-state" }, React.createElement(Text, {}, message)),
    Avatar: ({ name, size }: { name: string; size?: string }) =>
      React.createElement(View, { testID: "avatar" }),
  };
});

// =============================================================================
// GLOBAL TEST UTILITIES
// =============================================================================

const resetChallengesState = () => {
  mockChallengesState.activeChallenges.data = [];
  mockChallengesState.activeChallenges.isLoading = false;
  mockChallengesState.activeChallenges.error = null;
  mockChallengesState.completedChallenges.data = [];
  mockChallengesState.completedChallenges.isLoading = false;
  mockChallengesState.pendingInvites.data = [];
  mockChallengesState.pendingInvites.isLoading = false;
  mockChallengesState.challenge.data = null;
  mockChallengesState.challenge.isLoading = false;
  mockChallengesState.challenge.error = null;
  mockChallengesState.leaderboard.data = [];
  mockChallengesState.respondToInvite.isPending = false;
  mockChallengesState.createChallenge.isPending = false;
  mockChallengesState.logActivity.isPending = false;
};

beforeEach(() => {
  jest.clearAllMocks();

  mockAuthState.session = null;
  mockAuthState.user = null;
  mockAuthState.profile = null;
  mockAuthState.loading = false;
  mockAuthState.error = null;
  mockAuthState.pendingEmailConfirmation = false;

  resetChallengesState();

  mockChallengeStatus.effectiveStatus = "active";
  mockChallengeStatus.canLog = true;

  Object.keys(mockSearchParams).forEach((key) => delete mockSearchParams[key]);
});

export { resetChallengesState };

const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
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
