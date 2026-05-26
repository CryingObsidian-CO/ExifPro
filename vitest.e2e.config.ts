import {defineConfig} from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/tests/e2e/**/*.test.ts", "src/tests/e2e/**/*.spec.ts"],
    globals: true,
    testTimeout: 120000,
    hookTimeout: 180000,
  },
});