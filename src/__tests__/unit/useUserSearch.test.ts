import React, { PropsWithChildren, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUserSearch } from "@/hooks/useUserSearch";
import { authService } from "@/services/auth";

const TestRenderer: {
  create: (element: React.ReactElement) => { update: (element: React.ReactElement) => void };
} = require("react-test-renderer");
const { act }: {
  act: (callback: () => void | Promise<void>) => void | Promise<void>;
} = require("react-test-renderer");

jest.mock("@/services/auth", () => ({
  authService: {
    searchUsers: jest.fn(),
  },
}));

const mockSearchUsers = jest.mocked(authService.searchUsers);

type HookValue = ReturnType<typeof useUserSearch>;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function renderWithClient(
  queryClient: QueryClient,
  child: React.ReactElement,
) {
  return React.createElement(QueryClientProvider, { client: queryClient }, child);
}

function HookHarness({
  query,
  onValue,
}: PropsWithChildren<{ query: string; onValue: (value: HookValue) => void }>) {
  const value = useUserSearch(query);

  useEffect(() => {
    onValue(value);
  }, [onValue, value]);

  return null;
}

describe("useUserSearch", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSearchUsers.mockResolvedValue([]);
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("does not fire queries when input is shorter than 2 characters", async () => {
    let latestValue: HookValue | undefined;
    const queryClient = createQueryClient();

    await act(async () => {
      TestRenderer.create(
        renderWithClient(
          queryClient,
          React.createElement(HookHarness, {
            query: "a",
            onValue: (value) => {
              latestValue = value;
            },
          }),
        ),
      );
    });

    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(mockSearchUsers).not.toHaveBeenCalled();
    expect(latestValue?.debouncedQuery).toBe("a");
  });

  test("debounces the query before calling the service", async () => {
    let latestValue: HookValue | undefined;
    const queryClient = createQueryClient();

    await act(async () => {
      TestRenderer.create(
        renderWithClient(
          queryClient,
          React.createElement(HookHarness, {
            query: "alex",
            onValue: (value) => {
              latestValue = value;
            },
          }),
        ),
      );
    });

    await act(async () => {
      jest.advanceTimersByTime(299);
      await Promise.resolve();
    });
    expect(mockSearchUsers).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(mockSearchUsers).toHaveBeenCalledWith("alex");
    expect(latestValue?.debouncedQuery).toBe("alex");
  });

  test("resets the debounce timer when input changes", async () => {
    let latestValue: HookValue | undefined;
    let renderer: { update: (element: React.ReactElement) => void };
    const queryClient = createQueryClient();

    await act(async () => {
      renderer = TestRenderer.create(
        renderWithClient(
          queryClient,
          React.createElement(HookHarness, {
            query: "al",
            onValue: (value) => {
              latestValue = value;
            },
          }),
        ),
      );
    });

    await act(async () => {
      jest.advanceTimersByTime(200);
      renderer.update(
        renderWithClient(
          queryClient,
          React.createElement(HookHarness, {
            query: "alex",
            onValue: (value) => {
              latestValue = value;
            },
          }),
        ),
      );
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(mockSearchUsers).toHaveBeenCalledWith("alex");
    expect(mockSearchUsers).not.toHaveBeenCalledWith("al");
    expect(latestValue?.debouncedQuery).toBe("alex");
  });
});
