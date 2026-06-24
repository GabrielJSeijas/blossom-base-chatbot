import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: {
      // Environment variables for testing
      NODE_ENV: "test",
      SUPPRESS_STARTUP_LOGS: "true",
      MESSAGE_ENC_KEY_V1: "YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY=",
      AUTH_TOKEN_SECRET: "test-secret-key-for-blossom-qa-1234567890",
      MONGODB_URI: "mongodb://localhost:27017/blossom_test",
      MONGODB_DB_NAME: "blossom_test",
      ANTHROPIC_API_KEY: "test-anthropic-key-dummy",
      ANTHROPIC_MODEL: "claude-3-5-sonnet-latest",
      LLM_PROVIDER: "anthropic",
      BLOSSOM_SYSTEM_PROMPT_VARIANT: "default",
    },
    setupFiles: ["./tests/setup.js"],
    include: ["tests/**/*.test.js"],
    testTimeout: 10000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
