import type { Page } from "@playwright/test";

/**
 * Passes the temporary access gate when `ACCESS_CODE` is set, and does nothing
 * otherwise. Every spec calls it first.
 */
export async function unlock(page: Page): Promise<void> {
  const code = process.env.ACCESS_CODE;
  if (!code) return;

  await page.goto("/unlock");
  await page.getByLabel(/4-digit code|Access code/).pressSequentially(code);
  await page.keyboard.press("Enter");
  await page.waitForURL((url) => url.pathname !== "/unlock");
}
