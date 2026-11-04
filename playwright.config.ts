import { defineConfig, devices } from "@playwright/test";

// Both dev servers keep data in memory, shared by every test in a run, so
// specs create their own uniquely named links (see e2e/helpers.ts).
export default defineConfig({
  testDir: "e2e",
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm dev:server",
      url: "http://localhost:3000/health",
      reuseExistingServer: true,
      // Request logs would drown the test output.
      env: { LOG_LEVEL: "warn" },
    },
    {
      command: "pnpm dev:web",
      url: "http://localhost:5173",
      reuseExistingServer: true,
    },
  ],
});
