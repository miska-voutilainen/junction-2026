import { expect, type Page } from "@playwright/test";

/**
 * Fails when the page's own copy holds a semicolon or an arrow: our copy uses
 * neither. Code, console output and text written by the model or by people
 * (marked `data-written-text`) are shown as they are, so they are skipped.
 * Shared by the fixture specs and the real-data spec: only recorded data
 * carries model prose, so only the real-data run catches unmarked model text.
 */
export async function expectNoSemicolonsOrArrows(page: Page, context?: string): Promise<void> {
  const offending = await page.evaluate(() => {
    const skipped = "[data-console], [data-written-text], pre, code, script, style, noscript";
    const found: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? "";
      if (/[;→]/.test(text) && !node.parentElement?.closest(skipped))
        found.push(text.trim().slice(0, 120));
    }
    return found;
  });
  expect(offending, context).toEqual([]);
}
