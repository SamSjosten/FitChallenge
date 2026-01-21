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
      displayName: "component",
      // Use jsdom for React component rendering
      testEnvironment: "jsdom",
      transform: {
        "^.+\\.(ts|tsx)$": [
          "ts-jest",
          {
            tsconfig: {
              jsx: "react-jsx",
              esModuleInterop: true,
            },
          },
        ],
      },
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
      // Match component tests
      testMatch: ["<rootDir>/src/__tests__/component/**/*.component.test.tsx"],
      setupFilesAfterEnv: ["<rootDir>/src/__tests__/component/jest.setup.ts"],
      // Longer timeout for component rendering
      testTimeout: 10000,
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
};
