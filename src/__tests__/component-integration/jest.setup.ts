// src/__tests__/component-integration/jest.setup.ts
// Jest setup for component-integration tests
//
// PHILOSOPHY: Mock at the network boundary only.
// - Real: Providers, hooks, services, validation
// - Mocked: Supabase client, RN platform modules, navigation
//
// This ensures we test real data flow through the component stack,
// catching bugs that pure component tests with full mocking would miss.

// =============================================================================
// EXPO WINTER RUNTIME POLYFILLS
// =============================================================================
// Jest 30 has strict scope checking that conflicts with expo's lazy loading.

if (typeof globalThis.structuredClone === "undefined") {
  (globalThis as any).structuredClone = <T>(obj: T): T =>
    JSON.parse(JSON.stringify(obj));
}

if (typeof (globalThis as any).__ExpoImportMetaRegistry === "undefined") {
  (globalThis as any).__ExpoImportMetaRegistry = {
    url: "http://localhost:8081",
  };
}

// Set __DEV__ to false to avoid config validation throws
(globalThis as any).__DEV__ = false;

jest.mock("expo/src/winter/runtime.native", () => ({}), { virtual: true });
jest.mock(
  "expo/src/winter/installGlobal",
  () => ({
    installGlobal: () => {},
    default: () => {},
  }),
  { virtual: true },
);

// =============================================================================
// ASYNC STORAGE MOCK
// =============================================================================
// Required for React Query persistence and other storage needs

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
    getAllKeys: jest.fn(() => Promise.resolve([])),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
    multiRemove: jest.fn(() => Promise.resolve()),
  },
}));

// =============================================================================
// EXPO SECURE STORE MOCK
// =============================================================================

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// =============================================================================
// CONFIG MOCK (Must be before supabase import)
// =============================================================================

jest.mock("@/constants/config", () => ({
  Config: {
    supabaseUrl: "https://test.supabase.co",
    supabaseAnonKey: "test-anon-key",
    sentryDsn: "",
    environment: "test",
  },
  configValidation: {
    isValid: true,
    message: "",
  },
}));

// =============================================================================
// STORAGE PROBE MOCK
// =============================================================================

jest.mock("@/lib/storageProbe", () => ({
  createResilientStorageAdapter: () => ({
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  }),
  getStorageStatus: jest.fn(() => ({
    probeComplete: true,
    activeAdapter: "memory",
    secureStoreAvailable: false,
    asyncStorageAvailable: false,
    consecutiveFailures: 0,
  })),
  isStorageProbeComplete: jest.fn(() => true),
  storageProbePromise: Promise.resolve(),
  subscribeToStorageStatus: jest.fn(() => () => {}),
}));

import "@testing-library/jest-native/extend-expect";

// =============================================================================
// MOCK SUPABASE CLIENT (Network Boundary)
// =============================================================================
// This is THE key mock - everything else flows through this
// NOTE: We use a module-level variable that gets set before tests run.
// Jest mocks are hoisted, so we need the mock to reference a mutable object.

import {
  createMockSupabaseClient,
  createMockSession,
  type MockSupabaseClient,
} from "./mockSupabaseClient";

// Create the mock client instance - this is THE source of truth
export const mockSupabaseClient: MockSupabaseClient =
  createMockSupabaseClient();

// Store reference in a mutable container that the hoisted mock can access
const mockClientRef = { current: mockSupabaseClient };

// Mock the supabase module to return our mock client
// Use a factory that reads from mockClientRef.current
jest.mock("@/lib/supabase", () => {
  // Import the mock reference at mock evaluation time
  const getMockClient = () => {
    // This will be evaluated when the mock is called, not when it's defined
    return require("./jest.setup").mockSupabaseClient;
  };

  return {
    getSupabaseClient: () => getMockClient(),
    requireUserId: async () => {
      const client = getMockClient();
      const { data } = await client.auth.getUser();
      if (!data.user) throw new Error("Authentication required");
      return data.user.id;
    },
    getUserId: async () => {
      const client = getMockClient();
      const { data } = await client.auth.getUser();
      return data.user?.id ?? null;
    },
    withAuth: async <T>(
      operation: (userId: string) => Promise<T>,
    ): Promise<T> => {
      const client = getMockClient();
      const { data } = await client.auth.getUser();
      if (!data.user) throw new Error("Authentication required");
      return operation(data.user.id);
    },
    supabaseConfigError: null,
    // Re-export storage status utilities (mocked)
    getStorageStatus: jest.fn(() => ({
      probeComplete: true,
      activeAdapter: "memory",
      secureStoreAvailable: false,
      asyncStorageAvailable: false,
      consecutiveFailures: 0,
    })),
    isStorageProbeComplete: jest.fn(() => true),
    storageProbePromise: Promise.resolve(),
    subscribeToStorageStatus: jest.fn(() => () => {}),
  };
});

// =============================================================================
// MOCK SERVER TIME (Prevents network calls)
// =============================================================================

jest.mock("@/lib/serverTime", () => ({
  getServerNow: jest.fn(() => new Date("2025-01-15T12:00:00Z")),
  syncServerTime: jest.fn().mockResolvedValue(undefined),
  getDaysRemaining: jest.fn(() => 7),
  RESYNC_INTERVAL_MS: 300000,
}));

// =============================================================================
// MOCK PUSH TOKEN SERVICE (Prevents network calls)
// =============================================================================

jest.mock("@/services/pushTokens", () => ({
  pushTokenService: {
    requestAndRegister: jest.fn().mockResolvedValue(undefined),
    registerToken: jest.fn().mockResolvedValue(undefined),
    disableCurrentToken: jest.fn().mockResolvedValue(undefined),
  },
}));

// =============================================================================
// MOCK FONT LOADING
// =============================================================================
// ThemeProvider needs fonts to be loaded to render children

jest.mock("@expo-google-fonts/plus-jakarta-sans", () => ({
  useFonts: () => [true], // Always return loaded
  PlusJakartaSans_400Regular: "PlusJakartaSans_400Regular",
  PlusJakartaSans_500Medium: "PlusJakartaSans_500Medium",
  PlusJakartaSans_600SemiBold: "PlusJakartaSans_600SemiBold",
  PlusJakartaSans_700Bold: "PlusJakartaSans_700Bold",
}));

// =============================================================================
// EXPO/RN PLATFORM MODULE MOCKS
// =============================================================================
// These modules have native dependencies that can't run in jsdom

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaView: ({
      children,
      style,
    }: {
      children: React.ReactNode;
      style?: any;
    }) => React.createElement(View, { style }, children),
    useSafeAreaInsets: () => ({
      top: 44,
      bottom: 34,
      left: 0,
      right: 0,
    }),
  };
});

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children: any }) => children,
}));

jest.mock("react-native-heroicons/outline", () => ({
  ChevronLeftIcon: () => null,
  ChevronRightIcon: () => null,
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
  ChevronDownIcon: () => null,
  ChevronUpIcon: () => null,
  ArrowLeftIcon: () => null,
  Cog6ToothIcon: () => null,
  BellIcon: () => null,
  UserGroupIcon: () => null,
}));

jest.mock("react-native-heroicons/solid", () => ({
  ChevronLeftIcon: () => null,
  PlusIcon: () => null,
  TrophyIcon: () => null,
  FireIcon: () => null,
  HomeIcon: () => null,
  UserIcon: () => null,
}));

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
// EXPO ROUTER MOCK
// =============================================================================
// Navigation mocked for testability - real navigation requires native stack

export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
  setParams: jest.fn(),
};

export const mockSearchParams: Record<string, string> = {};

jest.mock("expo-router", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    router: mockRouter,
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockSearchParams,
    useSegments: () => [],
    useFocusEffect: (callback: () => void) => {
      React.useEffect(() => {
        callback();
      }, []);
    },
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
      return React.createElement(View, { testID: `link-${href}` }, children);
    },
    Redirect: () => null,
  };
});

// =============================================================================
// REACT QUERY SETUP
// =============================================================================
// Provide fresh QueryClient for each test to prevent cache pollution

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Don't retry in tests
        gcTime: 0, // Disable garbage collection
        staleTime: 0, // Always consider data stale
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// =============================================================================
// TEST WRAPPER COMPONENT
// =============================================================================
// Provides all necessary context for integration component tests

import { AuthProvider } from "@/providers/AuthProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";

interface TestWrapperProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
}

/**
 * Wraps components with real providers for integration testing.
 * Uses mocked Supabase client at the network boundary.
 *
 * Usage:
 * ```typescript
 * render(<HomeScreen />, { wrapper: TestWrapper });
 * ```
 */
export function TestWrapper({ children, queryClient }: TestWrapperProps) {
  const client = queryClient ?? createTestQueryClient();

  return React.createElement(
    QueryClientProvider,
    { client },
    React.createElement(
      ThemeProvider,
      null,
      React.createElement(AuthProvider, null, children),
    ),
  );
}

/**
 * Create a wrapper function for use with render().
 * Allows custom QueryClient if needed.
 */
export function createTestWrapper(queryClient?: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(TestWrapper, { queryClient, children });
  };
}

// =============================================================================
// TEST LIFECYCLE HOOKS
// =============================================================================

// Reset all mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
  mockSupabaseClient.__reset();

  // Reset search params
  Object.keys(mockSearchParams).forEach((key) => delete mockSearchParams[key]);
});

// =============================================================================
// CONSOLE NOISE SUPPRESSION
// =============================================================================

const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args: any[]) => {
    // Filter out React Native expected warnings
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Warning:") ||
        args[0].includes("React Native") ||
        args[0].includes("act(...)"))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args: any[]) => {
    // Filter out auth/sync warnings during tests
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Server time sync") || args[0].includes("Push token"))
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// =============================================================================
// RE-EXPORTS FOR TEST CONVENIENCE
// =============================================================================

export { createMockSession, createMockUser } from "./mockSupabaseClient";
export type { MockSupabaseClient } from "./mockSupabaseClient";
