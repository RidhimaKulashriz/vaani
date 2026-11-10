import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.next-dev/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "**/tests/e2e/**",
    ],
  },
});
