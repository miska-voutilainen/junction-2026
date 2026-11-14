import { expect, test } from "./fixtures";
import { unlock } from "./unlock";

// S1 to S5. mp-2283 is a signed fixture change, so its receipt page exists.
const pages = ["/", "/changes/mp-2283", "/changes/mp-2283/receipt", "/reviewer", "/dashboard"];

const expectedHeaders: Record<string, RegExp> = {
  "content-security-policy":
    /default-src 'self'.*frame-ancestors 'none'.*base-uri 'self'.*form-action 'self'.*object-src 'none'/,
  "x-content-type-options": /^nosniff$/,
  "referrer-policy": /^strict-origin-when-cross-origin$/,
  "permissions-policy": /camera=\(\).*microphone=\(\).*geolocation=\(\)/,
  "x-frame-options": /^DENY$/,
};

test.beforeEach(async ({ page }) => {
  await unlock(page);
});

// The `consoleProblems` fixture fails the test on any console error, which is
// how a policy that is too tight shows itself: the browser reports each blocked
// script, style, font or image as a CSP violation.
for (const route of pages) {
  test(`${route} sends the security headers and loads with a clean console`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    const headers = response?.headers() ?? {};
    for (const [name, pattern] of Object.entries(expectedHeaders)) {
      expect(headers[name], `${name} on ${route}`).toMatch(pattern);
    }
    await expect(page.getByRole("heading", { level: 1 })).toBeAttached();
  });
}
