import { cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = process.env.PORT ?? "3000";
// The real-data project gets its own server, one port up.
const realDataPort = String(Number(port) + 1);
const externalBaseUrl = process.env.E2E_BASE_URL;
// Preview URLs sit behind Vercel Authentication; the e2e-preview workflow sends this header to pass it.
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

// The behaviour specs run on fixture data so they stay deterministic while the
// recorded data changes. The loaders look in `<root>/fixtures`, so the fixture
// root is a folder holding a copy of `data/fixtures` under that name. Only the
// runner process copies it: workers load this file too and must not race it.
const fixtureDataRoot = path.join(process.cwd(), ".review", "e2e-data-root");
if (process.env.TEST_WORKER_INDEX === undefined && !externalBaseUrl) {
  rmSync(fixtureDataRoot, { recursive: true, force: true });
  mkdirSync(fixtureDataRoot, { recursive: true });
  cpSync(path.join(process.cwd(), "data", "fixtures"), path.join(fixtureDataRoot, "fixtures"), { recursive: true });
}

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: externalBaseUrl ?? `http://localhost:${port}`,
    extraHTTPHeaders: bypassSecret ? { "x-vercel-protection-bypass": bypassSecret } : undefined,
  },
  projects: [
    {
      name: "desktop",
      testIgnore: ["screenshots.spec.ts", "real-data.spec.ts"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      testIgnore: ["screenshots.spec.ts", "real-data.spec.ts"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
    },
    // Reads the committed data/ as it is, on the second server.
    {
      name: "real-data",
      testMatch: "real-data.spec.ts",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, baseURL: externalBaseUrl ?? `http://localhost:${realDataPort}` },
    },
    // Sets its own viewports per test; only `pnpm screenshots` runs it.
    {
      name: "screenshots",
      testMatch: "screenshots.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Two production servers. Pages are generated at build time, so each server is built with
  // its own COUNTERSIGN_DATA_ROOT (and its own build folder: two `next build`s must not share .next).
  // A server already running on a port is reused as it is, so stop it before switching ACCESS_CODE
  // or data; a server built without these settings would silently serve the wrong data.
  webServer: externalBaseUrl
    ? undefined
    : [
        {
          command: "pnpm build && pnpm start",
          url: `http://localhost:${port}`,
          env: { COUNTERSIGN_DATA_ROOT: fixtureDataRoot },
          reuseExistingServer: !process.env.CI,
          timeout: 240_000,
        },
        {
          command: `pnpm build && pnpm start --port ${realDataPort}`,
          url: `http://localhost:${realDataPort}`,
          env: { NEXT_DIST_DIR: "node_modules/.cache/next-real-data" },
          reuseExistingServer: !process.env.CI,
          timeout: 240_000,
        },
      ],
});
