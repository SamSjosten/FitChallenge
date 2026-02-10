// https://docs.expo.dev/guides/using-eslint/
const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const prettierConfig = require("eslint-config-prettier");

module.exports = defineConfig([
  // Expo base: TypeScript, React, React Hooks, Import, Expo-specific rules
  expoConfig,

  // Disable ESLint rules that conflict with Prettier formatting
  prettierConfig,

  // Global ignores: generated files, build artifacts, native dirs
  globalIgnores([
    "dist/*",
    ".expo/*",
    "node_modules/*",
    "android/*",
    "ios/*",
    "coverage/*",
    "supabase/functions/*",
    "src/types/database.ts",
    "e2e/*",
    // Mock test infrastructure — scheduled for removal (Phase 3)
    "src/__tests__/component/*",
    "src/__tests__/component-integration/*",
  ]),

  // Optional native dependencies the import resolver cannot find
  {
    rules: {
      "import/no-unresolved": ["error", { ignore: ["react-native-health"] }],
    },
  },
]);
