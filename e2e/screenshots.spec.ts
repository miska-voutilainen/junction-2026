import { test } from "@playwright/test";
import { unlock } from "./unlock";

// Run by `pnpm screenshots` only; the output in .review/ is read by the ux-reviewer.
const PAGES = [
  { name: "inbox", path: "/" },
  { name: "review", path: "/changes/mp-2283" },
  { name: "reviewer", path: "/reviewer" },
];
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 375, height: 812 },
];

for (const viewport of VIEWPORTS) {
  for (const { name, path } of PAGES) {
    test(`${name} at ${viewport.width}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      // Reduced motion shows rows at rest, so no screenshot catches a half-faded element.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await unlock(page);
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      // Skeletons carry aria-busy; wait until none is left.
      await page.waitForFunction(
        () => !document.querySelector('[aria-busy="true"], [data-slot="skeleton"]'),
      );
      await page.screenshot({ path: `.review/${name}-${viewport.width}.png`, fullPage: true });
    });
  }
}
