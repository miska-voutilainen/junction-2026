import { defineConfig, devices } from "@playwright/test";

const port = process.env.PORT ?? "3000";
const externalBaseUrl = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: externalBaseUrl ?? `http://localhost:${port}` },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } },
    },
  ],
  // Builds and serves the production app; the server inherits ACCESS_CODE from this process.
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "pnpm build && pnpm start",
        url: `http://localhost:${port}`,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});
