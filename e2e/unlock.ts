import type { Page } from "@playwright/test";

/**
 * Gets a page past what stands in front of a deployed site: Vercel Authentication (when
 * `VERCEL_AUTOMATION_BYPASS_SECRET` is set) and the temporary access gate (when `ACCESS_CODE`
 * is set). Does nothing for a local server. Every spec calls it first.
 */
export async function unlock(page: Page): Promise<void> {
  await sendBypassHeaders(page);

  const code = process.env.ACCESS_CODE;
  if (!code) return;

  await page.goto("/unlock");
  // The form submits itself on the last character.
  await page.getByLabel(/4-digit code|Access code/).pressSequentially(code);
  await page.waitForURL((url) => url.pathname !== "/unlock");
}

/**
 * Adds Vercel's bypass header to requests to the deployment's own origin and to nothing else,
 * so the secret never goes to a font or analytics host. The toolbar header keeps Vercel's
 * preview toolbar, and its console noise, out of the page.
 */
async function sendBypassHeaders(page: Page): Promise<void> {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const baseUrl = process.env.E2E_BASE_URL;
  if (!secret || !baseUrl) return;

  await page.context().route(`${new URL(baseUrl).origin}/**`, (route) =>
    route.continue({
      headers: {
        ...route.request().headers(),
        "x-vercel-protection-bypass": secret,
        "x-vercel-skip-toolbar": "1",
      },
    }),
  );
}
