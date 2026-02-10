const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },

  // Use projects for different test types
  projects: [
    {
      displayName: "unit",
      testEnvironment: "node",
      transform: {
        ...tsJestTransformCfg,
      },
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
      // Match unit tests (in __tests__ folders but NOT .integration.test.ts or .component.test.tsx)
      testMatch: ["<rootDir>/src/**/__tests__/**/*.test.ts"],
      testPathIgnorePatterns: [
        "/node_modules/",
        "\\.integration\\.test\\.ts$",
        "\\.component\\.test\\.tsx?$",
      ],
    },
    {
      displayName: "integration",
      testEnvironment: "node",
      transform: {
        ...tsJestTransformCfg,
      },
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
      // Only match integration tests
      testMatch: ["<rootDir>/src/**/__tests__/**/*.integration.test.ts"],
      // Longer timeout for network calls
      testTimeout: 30000,
    },
  ],

  // Coverage thresholds - prevents shipping untested code
  // Thresholds set conservatively; ratchet upward as coverage improves
  coverageThreshold: {
    global: {
      lines: 60,
      branches: 50,
      functions: 55,
      statements: 60,
    },
    // Per-file thresholds for src/lib (set to floor of current coverage)
    "./src/lib/**/*.ts": {
      lines: 35,
      branches: 25,
      functions: 30,
      statements: 35,
    },
    // Services have lower thresholds - primarily covered by integration tests
    "./src/services/**/*.ts": {
      lines: 20,
      branches: 5,
      functions: 20,
      statements: 20,
    },
  },
};
