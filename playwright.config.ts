import { defineConfig, devices } from "@playwright/test";

const port = process.env.PORT ?? "3000";
const externalBaseUrl = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: externalBaseUrl ?? `http://localhost:${port}` },
  projects: [
    {
      name: "desktop",
      testIgnore: "screenshots.spec.ts",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      testIgnore: "screenshots.spec.ts",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
    },
    // Sets its own viewports per test; only `pnpm screenshots` runs it.
    {
      name: "screenshots",
      testMatch: "screenshots.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Builds and serves the production app; the server inherits ACCESS_CODE from this process.
  // A server already running on the port is reused as it is, so stop it before switching ACCESS_CODE.
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "pnpm build && pnpm start",
        url: `http://localhost:${port}`,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});
