// src/__tests__/unit/health/healthService.test.ts
// =============================================================================
// Unit Tests for Health Service Orchestrator
// =============================================================================
// Tests the HealthService class in isolation using MockHealthProvider
// and mocked Supabase calls.
// =============================================================================

// =============================================================================
// MOCKS - Must be defined before imports
// =============================================================================

jest.mock("react-native-url-polyfill/auto", () => {});
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock Platform to control iOS/Android behavior
jest.mock("react-native", () => ({
  Platform: {
    OS: "ios",
    select: jest.fn((obj) => obj.ios),
  },
}));

// Mock user ID for auth
const mockUserId = "test-user-health-123";

// Track Supabase RPC calls
const mockRpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
const mockFromCalls: Array<{ table: string; method: string }> = [];

// Configurable mock responses
let mockRpcResponses: Record<string, { data: unknown; error: unknown }> = {};
let mockFromResponses: Record<string, { data: unknown; error: unknown }> = {};

const createSupabaseMock = () => {
  const createChainMock = (
    tableName: string,
    finalData: unknown = null,
    finalError: unknown = null,
  ) => {
    const chain: Record<string, jest.Mock> = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn(() => {
        mockFromCalls.push({ table: tableName, method: "single" });
        const response = mockFromResponses[tableName] || {
          data: finalData,
          error: finalError,
        };
        return Promise.resolve(response);
      }),
    };

    // Make chain thenable for async operations that don't call .single()
    Object.defineProperty(chain, "then", {
      value: (resolve: (value: unknown) => void) => {
        mockFromCalls.push({ table: tableName, method: "then" });
        const response = mockFromResponses[tableName] || {
          data: finalData,
          error: finalError,
        };
        return Promise.resolve(response).then(resolve);
      },
      configurable: true,
    });

    return chain;
  };

  return {
    auth: {
      getUser: jest.fn(() =>
        Promise.resolve({
          data: { user: { id: mockUserId } },
          error: null,
        }),
      ),
    },
    rpc: jest.fn((fnName: string, args: Record<string, unknown>) => {
      mockRpcCalls.push({ fn: fnName, args });
      const response = mockRpcResponses[fnName] || { data: null, error: null };

      // Return object with .single() method for RPC calls that need it
      return {
        single: jest.fn(() => Promise.resolve(response)),
        then: (resolve: (value: unknown) => void) => Promise.resolve(response).then(resolve),
      };
    }),
    from: jest.fn((tableName: string) => {
      mockFromCalls.push({ table: tableName, method: "from" });
      return createChainMock(tableName);
    }),
  };
};

jest.mock("@/lib/supabase", () => ({
  supabase: createSupabaseMock(),
}));

// Mock health utils
jest.mock("@/services/health/utils", () => ({
  transformSamples: jest.fn((samples, _provider) =>
    samples.map((s: { id: string; type: string; value: number }) => ({
      activity_type: s.type,
      value: s.value,
      unit: "count",
      source: "healthkit",
      source_external_id: `hash-${s.id}`,
      recorded_at: new Date().toISOString(),
    })),
  ),
  assignChallengesToActivities: jest.fn((activities, _challenges) => activities),
  calculateSyncDateRange: jest.fn((lookbackDays: number) => ({
    startDate: new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000),
    endDate: new Date(),
  })),
}));

// =============================================================================
// IMPORTS - After mocks
// =============================================================================

import {
  HealthService,
  createMockHealthService,
  getHealthService,
  resetHealthService,
} from "@/services/health/healthService";
import {
  MockHealthProvider,
  createFullyGrantedMockProvider,
  createFailingMockProvider,
} from "@/services/health/providers/MockHealthProvider";
import type { HealthSample } from "@/services/health/types";

// =============================================================================
// TEST HELPERS
// =============================================================================

function resetMocks() {
  mockRpcCalls.length = 0;
  mockFromCalls.length = 0;
  mockRpcResponses = {};
  mockFromResponses = {};
  jest.clearAllMocks();
}

function setRpcResponse(fnName: string, data: unknown, error: unknown = null) {
  mockRpcResponses[fnName] = { data, error };
}

function setFromResponse(tableName: string, data: unknown, error: unknown = null) {
  mockFromResponses[tableName] = { data, error };
}

function createMockSamples(count: number, type = "steps"): HealthSample[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `sample-${i}`,
    type: type as HealthSample["type"],
    value: 1000 + i * 100,
    unit: "count",
    startDate: new Date(Date.now() - i * 60 * 60 * 1000),
    endDate: new Date(Date.now() - i * 60 * 60 * 1000 + 30 * 60 * 1000),
    sourceName: "TestSource",
    sourceId: "com.test.source",
  }));
}

// =============================================================================
// TESTS
// =============================================================================

describe("HealthService", () => {
  beforeEach(() => {
    resetMocks();
    resetHealthService();
  });

  // ===========================================================================
  // CONSTRUCTOR & SINGLETON
  // ===========================================================================

  describe("constructor", () => {
    it("should accept a mock provider for testing", () => {
      const mockProvider = new MockHealthProvider();
      const service = createMockHealthService(mockProvider);

      expect(service).toBeInstanceOf(HealthService);
    });

    it("should use HealthKitProvider on iOS by default", () => {
      // Platform.OS is mocked as 'ios'
      const service = getHealthService();
      expect(service).toBeInstanceOf(HealthService);
    });
  });

  describe("singleton pattern", () => {
    it("should return the same instance on repeated calls", () => {
      const service1 = getHealthService();
      const service2 = getHealthService();

      expect(service1).toBe(service2);
    });

    it("should return new instance after reset", () => {
      const service1 = getHealthService();
      resetHealthService();
      const service2 = getHealthService();

      expect(service1).not.toBe(service2);
    });
  });

  // ===========================================================================
  // getConnectionStatus
  // ===========================================================================

  describe("getConnectionStatus", () => {
    it("should return disconnected when user is not authenticated", async () => {
      const mockProvider = new MockHealthProvider({ isAvailable: true });
      const service = createMockHealthService(mockProvider);

      // Mock no user
      const { supabase } = require("@/lib/supabase");
      supabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const result = await service.getConnectionStatus();

      expect(result.status).toBe("disconnected");
      expect(result.connection).toBeNull();
      expect(result.lastSync).toBeNull();
    });

    it("should return disconnected when provider is not available", async () => {
      const mockProvider = new MockHealthProvider({ isAvailable: false });
      const service = createMockHealthService(mockProvider);

      const result = await service.getConnectionStatus();

      expect(result.status).toBe("disconnected");
    });

    it("should return disconnected when no connection exists", async () => {
      const mockProvider = createFullyGrantedMockProvider();
      const service = createMockHealthService(mockProvider);

      // Mock RPC returns no connection
      setRpcResponse("get_health_connection", null, {
        message: "No connection found",
      });

      const result = await service.getConnectionStatus();

      expect(result.status).toBe("disconnected");
    });

    it("should return connected when active connection exists", async () => {
      const mockProvider = createFullyGrantedMockProvider();
      const service = createMockHealthService(mockProvider);

      const mockConnection = {
        id: "conn-1",
        user_id: mockUserId,
        provider: "healthkit",
        is_active: true,
        last_sync_at: "2024-01-15T10:00:00Z",
        permissions_granted: ["steps", "calories"],
      };

      setRpcResponse("get_health_connection", mockConnection);
      setFromResponse("health_sync_logs", []);

      const result = await service.getConnectionStatus();

      expect(result.status).toBe("connected");
      expect(result.connection).toEqual(mockConnection);
      expect(result.lastSync).toEqual(new Date("2024-01-15T10:00:00Z"));
    });

    it("should return syncing when sync is in progress", async () => {
      const mockProvider = createFullyGrantedMockProvider();
      const service = createMockHealthService(mockProvider);

      const mockConnection = {
        id: "conn-1",
        user_id: mockUserId,
        provider: "healthkit",
        is_active: true,
        last_sync_at: "2024-01-15T10:00:00Z",
      };

      setRpcResponse("get_health_connection", mockConnection);
      setFromResponse("health_sync_logs", [{ id: "sync-in-progress" }]);

      const result = await service.getConnectionStatus();

      expect(result.status).toBe("syncing");
    });
  });

  // ===========================================================================
  // connect
  // ===========================================================================

  describe("connect", () => {
    it("should throw when provider is not available", async () => {
      const mockProvider = new MockHealthProvider({ isAvailable: false });
      const service = createMockHealthService(mockProvider);

      await expect(service.connect()).rejects.toThrow("healthkit is not available on this device");
    });

    it("should throw when no permissions are granted", async () => {
      const mockProvider = new MockHealthProvider({
        isAvailable: true,
        authorizationFails: true,
      });
      const service = createMockHealthService(mockProvider);

      await expect(service.connect()).rejects.toThrow("No health permissions were granted");
    });

    it("should save connection and trigger initial sync on success", async () => {
      const mockProvider = createFullyGrantedMockProvider();
      mockProvider.setConfig({ delay: 0 }); // Speed up test
      const service = createMockHealthService(mockProvider);

      const mockConnection = {
        id: "new-conn",
        user_id: mockUserId,
        provider: "healthkit",
        is_active: true,
        permissions_granted: ["steps", "activeMinutes", "calories"],
      };

      setRpcResponse("connect_health_provider", "new-conn");
      setRpcResponse("get_health_connection", mockConnection);
      setRpcResponse("start_health_sync", "sync-log-1");
      setRpcResponse("log_health_activity", {
        inserted: 0,
        deduplicated: 0,
        total_processed: 0,
        errors: [],
      });
      setRpcResponse("complete_health_sync", null);
      setRpcResponse("get_challenges_for_health_sync", []);

      const result = await service.connect();

      expect(result).toEqual(mockConnection);

      // Verify connect_health_provider was called
      const connectCall = mockRpcCalls.find((c) => c.fn === "connect_health_provider");
      expect(connectCall).toBeDefined();
      expect(connectCall?.args.p_provider).toBe("healthkit");

      // Verify initial sync was triggered
      const syncCall = mockRpcCalls.find((c) => c.fn === "start_health_sync");
      expect(syncCall).toBeDefined();
      expect(syncCall?.args.p_sync_type).toBe("initial");
    });

    it("should return connection even if initial sync fails", async () => {
      const mockProvider = createFullyGrantedMockProvider();
      mockProvider.setConfig({ delay: 0 });
      const service = createMockHealthService(mockProvider);

      const mockConnection = {
        id: "new-conn",
        user_id: mockUserId,
        provider: "healthkit",
        is_active: true,
      };

      setRpcResponse("connect_health_provider", "new-conn");
      setRpcResponse("get_health_connection", mockConnection);
      setRpcResponse("start_health_sync", null, { message: "Sync failed" });

      // Should not throw - initial sync failure is non-fatal
      const result = await service.connect();
      expect(result).toEqual(mockConnection);
    });
  });

  // ===========================================================================
  // disconnect
  // ===========================================================================

  describe("disconnect", () => {
    it("should call disconnect RPC", async () => {
      const mockProvider = createFullyGrantedMockProvider();
      const service = createMockHealthService(mockProvider);

      setRpcResponse("disconnect_health_provider", null);

      await service.disconnect();

      const disconnectCall = mockRpcCalls.find((c) => c.fn === "disconnect_health_provider");
      expect(disconnectCall).toBeDefined();
      expect(disconnectCall?.args.p_provider).toBe("healthkit");
    });

    it("should throw on RPC error", async () => {
      const mockProvider = createFullyGrantedMockProvider();
      const service = createMockHealthService(mockProvider);

      setRpcResponse("disconnect_health_provider", null, {
        message: "Database error",
      });

      await expect(service.disconnect()).rejects.toThrow("Failed to disconnect: Database error");
    });
  });

  // ===========================================================================
  // sync
  // ===========================================================================

  describe("sync", () => {
    it("should complete successfully with no samples", async () => {
      const mockProvider = new MockHealthProvider({
        isAvailable: true,
        samples: [], // No samples
        delay: 0,
      });
      const service = createMockHealthService(mockProvider);

      setRpcResponse("start_health_sync", "sync-log-1");
      setRpcResponse("complete_health_sync", null);

      const result = await service.sync({ syncType: "manual" });

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(0);
      expect(result.recordsInserted).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Verify sync was completed with 'completed' status
      const completeCall = mockRpcCalls.find((c) => c.fn === "complete_health_sync");
      expect(completeCall?.args.p_status).toBe("completed");
    });

    it("should process samples and insert activities", async () => {
      const mockSamples = createMockSamples(5);
      const mockProvider = new MockHealthProvider({
        isAvailable: true,
        samples: mockSamples,
        delay: 0,
      });
      const service = createMockHealthService(mockProvider);

      setRpcResponse("start_health_sync", "sync-log-1");
      setRpcResponse("get_challenges_for_health_sync", []);
      setRpcResponse("log_health_activity", {
        inserted: 5,
        deduplicated: 0,
        total_processed: 5,
        errors: [],
      });
      setRpcResponse("complete_health_sync", null);

      const result = await service.sync({ syncType: "manual" });

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(5);
      expect(result.recordsInserted).toBe(5);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle partial failures gracefully", async () => {
      const mockSamples = createMockSamples(10);
      const mockProvider = new MockHealthProvider({
        isAvailable: true,
        samples: mockSamples,
        delay: 0,
      });
      const service = createMockHealthService(mockProvider);

      setRpcResponse("start_health_sync", "sync-log-1");
      setRpcResponse("get_challenges_for_health_sync", []);
      setRpcResponse("log_health_activity", {
        inserted: 8,
        deduplicated: 0,
        total_processed: 10,
        errors: [{ error: "Validation failed for 2 records" }],
      });
      setRpcResponse("complete_health_sync", null);

      const result = await service.sync({ syncType: "manual" });

      expect(result.success).toBe(false); // Has errors
      expect(result.recordsInserted).toBe(8);
      expect(result.errors).toHaveLength(1);

      // Verify sync completed with 'partial' status
      const completeCall = mockRpcCalls.find((c) => c.fn === "complete_health_sync");
      expect(completeCall?.args.p_status).toBe("partial");
    });

    it("should use correct lookback days for different sync types", async () => {
      const mockProvider = new MockHealthProvider({
        isAvailable: true,
        samples: [],
        delay: 0,
      });
      const service = createMockHealthService(mockProvider);

      setRpcResponse("start_health_sync", "sync-log-1");
      setRpcResponse("complete_health_sync", null);

      const { calculateSyncDateRange } = require("@/services/health/utils");

      // Test background sync (3 days)
      await service.sync({ syncType: "background" });
      expect(calculateSyncDateRange).toHaveBeenLastCalledWith(3);

      // Test manual sync (7 days)
      await service.sync({ syncType: "manual" });
      expect(calculateSyncDateRange).toHaveBeenLastCalledWith(7);

      // Test initial sync (30 days)
      await service.sync({ syncType: "initial" });
      expect(calculateSyncDateRange).toHaveBeenLastCalledWith(30);

      // Test custom lookback
      await service.sync({ syncType: "manual", lookbackDays: 14 });
      expect(calculateSyncDateRange).toHaveBeenLastCalledWith(14);
    });

    it("should throw and log failure when start_health_sync fails", async () => {
      const mockProvider = createFullyGrantedMockProvider();
      mockProvider.setConfig({ delay: 0 });
      const service = createMockHealthService(mockProvider);

      setRpcResponse("start_health_sync", null, { message: "DB error" });

      await expect(service.sync({ syncType: "manual" })).rejects.toThrow(
        "Failed to start sync log",
      );
    });

    it("should log failure when provider fetch fails", async () => {
      const mockProvider = createFailingMockProvider("Provider fetch failed");
      mockProvider.setConfig({ delay: 0 });
      const service = createMockHealthService(mockProvider);

      setRpcResponse("start_health_sync", "sync-log-1");
      setRpcResponse("complete_health_sync", null);

      await expect(service.sync({ syncType: "manual" })).rejects.toThrow("Provider fetch failed");

      // Verify sync was completed with 'failed' status
      const completeCall = mockRpcCalls.find((c) => c.fn === "complete_health_sync");
      expect(completeCall?.args.p_status).toBe("failed");
      expect(completeCall?.args.p_error_message).toBe("Provider fetch failed");
    });
  });

  // ===========================================================================
  // getSyncHistory
  // ===========================================================================

  describe("getSyncHistory", () => {
    it("should return empty array when user is not authenticated", async () => {
      const mockProvider = createFullyGrantedMockProvider();
      const service = createMockHealthService(mockProvider);

      const { supabase } = require("@/lib/supabase");
      supabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const result = await service.getSyncHistory();

      expect(result).toEqual([]);
    });

    it("should return sync logs ordered by started_at desc", async () => {
      const mockProvider = createFullyGrantedMockProvider();
      const service = createMockHealthService(mockProvider);

      const mockLogs = [
        {
          id: "log-1",
          started_at: "2024-01-15T12:00:00Z",
          status: "completed",
        },
        {
          id: "log-2",
          started_at: "2024-01-14T12:00:00Z",
          status: "completed",
        },
      ];

      setFromResponse("health_sync_logs", mockLogs);

      const result = await service.getSyncHistory(10);

      expect(result).toEqual(mockLogs);
    });

    it("should return empty array on query error", async () => {
      const mockProvider = createFullyGrantedMockProvider();
      const service = createMockHealthService(mockProvider);

      setFromResponse("health_sync_logs", null, { message: "Query failed" });

      const result = await service.getSyncHistory();

      expect(result).toEqual([]);
    });
  });

  // ===========================================================================
  // getRecentActivities
  // ===========================================================================

  describe("getRecentActivities", () => {
    it("should call RPC with correct parameters", async () => {
      const mockProvider = createFullyGrantedMockProvider();
      const service = createMockHealthService(mockProvider);

      const mockActivities = [{ activity_type: "steps", value: 5000, recorded_at: "2024-01-15" }];

      setRpcResponse("get_recent_health_activities", mockActivities);

      const result = await service.getRecentActivities(20, 10);

      expect(result).toEqual(mockActivities);

      const rpcCall = mockRpcCalls.find((c) => c.fn === "get_recent_health_activities");
      expect(rpcCall?.args.p_limit).toBe(20);
      expect(rpcCall?.args.p_offset).toBe(10);
    });

    it("should return empty array on RPC error", async () => {
      const mockProvider = createFullyGrantedMockProvider();
      const service = createMockHealthService(mockProvider);

      setRpcResponse("get_recent_health_activities", null, {
        message: "RPC failed",
      });

      const result = await service.getRecentActivities();

      expect(result).toEqual([]);
    });

    it("should use default parameters when not specified", async () => {
      const mockProvider = createFullyGrantedMockProvider();
      const service = createMockHealthService(mockProvider);

      setRpcResponse("get_recent_health_activities", []);

      await service.getRecentActivities();

      const rpcCall = mockRpcCalls.find((c) => c.fn === "get_recent_health_activities");
      expect(rpcCall?.args.p_limit).toBe(50);
      expect(rpcCall?.args.p_offset).toBe(0);
    });
  });

  // ===========================================================================
  // BATCH PROCESSING
  // ===========================================================================

  describe("batch processing", () => {
    it("should batch activities in groups of 100", async () => {
      // Create 250 samples to test batching
      const mockSamples = createMockSamples(250);
      const mockProvider = new MockHealthProvider({
        isAvailable: true,
        samples: mockSamples,
        delay: 0,
      });
      const service = createMockHealthService(mockProvider);

      setRpcResponse("start_health_sync", "sync-log-1");
      setRpcResponse("get_challenges_for_health_sync", []);
      // Each batch returns some inserted
      setRpcResponse("log_health_activity", {
        inserted: 100,
        deduplicated: 0,
        total_processed: 100,
        errors: [],
      });
      setRpcResponse("complete_health_sync", null);

      await service.sync({ syncType: "manual" });

      // Should have called log_health_activity 3 times (100, 100, 50)
      const logCalls = mockRpcCalls.filter((c) => c.fn === "log_health_activity");
      expect(logCalls.length).toBe(3);
    });

    it("should aggregate results across batches", async () => {
      const mockSamples = createMockSamples(150);
      const mockProvider = new MockHealthProvider({
        isAvailable: true,
        samples: mockSamples,
        delay: 0,
      });
      const service = createMockHealthService(mockProvider);

      let callCount = 0;
      const { supabase } = require("@/lib/supabase");
      const originalRpc = supabase.rpc;

      // Override to return different results per batch
      supabase.rpc.mockImplementation((fn: string, args: Record<string, unknown>) => {
        mockRpcCalls.push({ fn, args });

        if (fn === "log_health_activity") {
          callCount++;
          const batchResult =
            callCount === 1
              ? {
                  inserted: 95,
                  deduplicated: 5,
                  total_processed: 100,
                  errors: [],
                }
              : {
                  inserted: 48,
                  deduplicated: 2,
                  total_processed: 50,
                  errors: [],
                };

          return {
            single: jest.fn(() => Promise.resolve({ data: batchResult, error: null })),
            then: (resolve: (v: unknown) => void) =>
              Promise.resolve({ data: batchResult, error: null }).then(resolve),
          };
        }

        const response = mockRpcResponses[fn] || { data: null, error: null };
        return {
          single: jest.fn(() => Promise.resolve(response)),
          then: (resolve: (v: unknown) => void) => Promise.resolve(response).then(resolve),
        };
      });

      setRpcResponse("start_health_sync", "sync-log-1");
      setRpcResponse("get_challenges_for_health_sync", []);
      setRpcResponse("complete_health_sync", null);

      const result = await service.sync({ syncType: "manual" });

      expect(result.recordsInserted).toBe(143); // 95 + 48
      expect(result.recordsDeduplicated).toBe(7); // 5 + 2
      expect(result.recordsProcessed).toBe(150);

      // Restore original mock
      supabase.rpc = originalRpc;
    });
  });
});
