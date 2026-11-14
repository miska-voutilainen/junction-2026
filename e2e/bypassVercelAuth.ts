import type { Page } from "@playwright/test";

/**
 * Gets a page past Vercel Authentication, which covers every *.vercel.app preview, when
 * `VERCEL_AUTOMATION_BYPASS_SECRET` is set. Does nothing for a local server or the public
 * production domain. Every spec calls it first.
 */
export async function bypassVercelAuth(page: Page): Promise<void> {
  await sendBypassHeaders(page);
}

/**
 * The header that passes Vercel Authentication, or none when no secret is set (a local server).
 * For requests made outside the page, such as `page.request`, which the page route does not reach.
 */
export function bypassHeaders(): Record<string, string> {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  return secret ? { "x-vercel-protection-bypass": secret } : {};
}

/**
 * Adds Vercel's bypass header to requests to the deployment's own origin and to nothing else,
 * so the secret never goes to a font or analytics host. The toolbar header keeps Vercel's
 * preview toolbar, and its console noise, out of the page.
 */
async function sendBypassHeaders(page: Page): Promise<void> {
  const baseUrl = process.env.E2E_BASE_URL;
  if (!baseUrl || Object.keys(bypassHeaders()).length === 0) return;

  await page.context().route(`${new URL(baseUrl).origin}/**`, (route) =>
    route.continue({
      headers: {
        ...route.request().headers(),
        ...bypassHeaders(),
        "x-vercel-skip-toolbar": "1",
      },
    }),
  );
}
