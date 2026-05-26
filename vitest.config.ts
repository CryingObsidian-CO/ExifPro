import {defineConfig} from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/tests/unit/**/*.test.ts", "src/tests/unit/**/*.spec.ts"],
    globals: true,
    setupFiles: [],
    server: {
      deps: {
        inline: ["@tauri-apps/api"],
      },
    },
  },
  resolve: {
    alias: {},
  },
});