import { defineConfig } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "node src/server.js",
      cwd: path.resolve(__dirname, "../chain-reaction-server"),
      port: 3000,
      reuseExistingServer: true,
      env: {
        TURN_DURATION_MS: "120000", // 2 min — won't time out mid-test
        FRAME_DELAY_MS: "0",        // instant frame streaming
        LOG_LEVEL: "SILENT",
      },
    },
    {
      command: "npm run dev",
      url: "http://localhost:5173",
      reuseExistingServer: true,
    },
  ],
});
