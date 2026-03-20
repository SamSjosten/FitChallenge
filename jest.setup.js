/* global afterEach, jest */
// jest.setup.js — Global test setup for unit tests
// Loaded via setupFilesAfterEnv in jest.config.js (unit project only)

// React Native global
global.__DEV__ = true;

// Reset mocks between tests
afterEach(() => jest.restoreAllMocks());
