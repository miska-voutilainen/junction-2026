import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { bypassVercelAuth } from "./bypassVercelAuth";

// Regression guard for the acceptance checklist: contrast and semantics (axe),
// reflow (WCAG 1.4.10), keyboard, reduced motion and the no-percentage rule.

const CHANGE_IDS = ["mp-2283", "mp-2129", "mp-2234", "mp-2297"];
// A fork change has a receipt page even when nothing is signed yet (mp-2234, mp-2297).
const ROUTES = [
  "/",
  ...CHANGE_IDS.map((id) => `/changes/${id}`),
  ...CHANGE_IDS.map((id) => `/changes/${id}/receipt`),
  "/reviewer",
  "/dashboard",
  "/changes/no-such-change",
  "/no-such-page",
];
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
// 320 CSS px is WCAG 1.4.10's 1280 px at 400% zoom.
const REFLOW_WIDTHS = [320, 375, 768, 1024, 1280, 1440, 1920];
const STEP_TABS = [/Read/, /Blind check/, /Refused/, /Sign/];
const MAX_TAB_STOPS = 150;

async function expectNoViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const summary = results.violations.map((violation) => ({
    rule: violation.id,
    targets: violation.nodes.map((node) => node.target.join(" ")),
  }));
  expect(summary).toEqual([]);
}

/** Waits for hydration, which is when the first tab or button starts responding. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
}

test.beforeEach(async ({ page }) => {
  await bypassVercelAuth(page);
});

test.describe("axe, WCAG 2.2 AA", () => {
  for (const route of ROUTES) {
    test(`${route} has no violations`, async ({ page }) => {
      await page.goto(route);
      await settle(page);
      await expectNoViolations(page);
    });
  }

  for (const id of CHANGE_IDS) {
    for (const [index, name] of STEP_TABS.entries()) {
      test(`/changes/${id} step ${index + 1} has no violations`, async ({ page }) => {
        await page.goto(`/changes/${id}`);
        await settle(page);
        await page.getByRole("tab", { name }).click();
        await expect(page.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
        await expectNoViolations(page);
      });
    }
  }

  test("the command menu has no violations while open", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog")).toBeVisible();
    // The rows fade in one after another; axe reads text colour mid-fade as lower contrast than it ends up.
    await page.waitForTimeout(600);
    await expectNoViolations(page);
  });
});

test.describe("reflow", () => {
  test.skip(({ isMobile }) => isMobile, "sets its own viewports");

  for (const route of ROUTES) {
    test(`${route} fits every width without sideways scroll`, async ({ page }) => {
      await page.goto(route);
      await settle(page);
      for (const width of REFLOW_WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        const overflow = await page.evaluate(() => {
          const page = document.documentElement;
          // Code consoles scroll sideways on purpose: long lines stay on one line (UI plan section 6).
          const scrollers = [...document.body.querySelectorAll<HTMLElement>("*")]
            .filter((element) => !element.closest("[data-console]"))
            .filter((element) => /auto|scroll/.test(getComputedStyle(element).overflowX))
            .filter((element) => element.scrollWidth > element.clientWidth)
            .map((element) => element.tagName.toLowerCase() + "." + element.className);
          return { pageScrolls: page.scrollWidth > window.innerWidth, scrollers };
        });
        expect({ width, ...overflow }).toEqual({ width, pageScrolls: false, scrollers: [] });
      }
    });
  }
});

test.describe("keyboard", () => {
  for (const route of ["/", "/changes/mp-2283", "/changes/mp-2283/receipt"]) {
    test(`${route} tabs through with a visible focus indicator and no trap`, async ({ page }) => {
      await page.goto(route);
      await settle(page);
      await page.locator("body").click({ position: { x: 1, y: 1 } });
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

      let firstLabel: string | undefined;
      const problems: string[] = [];
      let stops = 0;
      for (; stops < MAX_TAB_STOPS; stops++) {
        await page.keyboard.press("Tab");
        const stop = await page.evaluate(() => {
          const element = document.activeElement;
          if (!element || element === document.body) return null;
          const box = element.getBoundingClientRect();
          const marksFocus = (node: Element) => {
            const style = getComputedStyle(node);
            return (
              (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) ||
              style.boxShadow !== "none"
            );
          };
          // An inbox row is one link stretched over the row; its ring is drawn on the row two levels up.
          const ring = [element, element.parentElement, element.parentElement?.parentElement];
          const hasIndicator = ring.some((node) => node != null && marksFocus(node));
          const label =
            element.tagName.toLowerCase() +
            ":" +
            (element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 30) ?? "");
          return {
            label,
            isVisible: box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight,
            hasIndicator,
          };
        });
        // Focus leaving the page (to the browser chrome) or back to the body ends the lap.
        if (stop === null) break;
        const key = stop.label + "#" + stops;
        // Back at the first stop after a full lap: the page has no trap.
        if (stops > 0 && stop.label === firstLabel) break;
        firstLabel ??= stop.label;
        if (!stop.isVisible) problems.push(`not visible: ${key}`);
        if (!stop.hasIndicator) problems.push(`no focus indicator: ${key}`);
      }
      expect(stops, "focus kept moving through more than a page of stops").toBeLessThan(
        MAX_TAB_STOPS,
      );
      expect(problems).toEqual([]);
    });
  }

  test("the skip link is the first stop and jumps to the content", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to content" });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#content$/);
  });

  test("Ctrl+K opens the menu, arrows move, Esc closes and returns focus to the trigger", async ({
    page,
  }) => {
    await page.goto("/");
    await settle(page);
    const trigger = page.locator("button[aria-haspopup='dialog']:visible").first();
    await trigger.focus();
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const active = dialog.locator("[role='option'][aria-selected='true']");
    const before = await active.first().textContent();
    await page.keyboard.press("ArrowDown");
    await expect(active.first()).not.toHaveText(before ?? "");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  for (const route of ROUTES) {
    test(`${route} runs no animation`, async ({ page }) => {
      await page.goto(route);
      await settle(page);
      await page.waitForTimeout(100);
      const running = await page.evaluate(() =>
        document
          .getAnimations()
          .filter((animation) => animation.playState === "running")
          // A transition or animation under 10 ms is a state change, not motion.
          .filter((animation) => Number(animation.effect?.getComputedTiming().duration ?? 0) > 10)
          .map((animation) => animation.id || animation.constructor.name),
      );
      expect(running).toEqual([]);
    });
  }

  test("opening a change, switching steps and copying still work", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => undefined);
    await page.goto("/");
    await settle(page);
    await page.locator("a[href='/changes/mp-2234']:visible").first().click();
    await expect(page).toHaveURL(/\/changes\/mp-2234$/);
    await settle(page);

    await page.getByRole("tab", { name: /Blind check/ }).click();
    await expect(page.getByRole("tab", { name: /Blind check/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await page.getByRole("tab", { name: /Sign/ }).click();
    await page.getByRole("button", { name: /^Copy/ }).first().click();
    await expect(page.getByText("Copied").first()).toBeVisible();
  });
});

test.describe("no confidence percentages", () => {
  // The routing threshold is documented policy, not model confidence; list anything else.
  const ALLOWED = [/75\s?%/];

  for (const route of ROUTES) {
    test(`${route} shows no percentage except the documented threshold`, async ({ page }) => {
      await page.goto(route);
      await settle(page);
      for (const name of STEP_TABS.filter(() =>
        CHANGE_IDS.some((id) => route === `/changes/${id}`),
      )) {
        await page.getByRole("tab", { name }).click();
        await expectNoPercentages(page);
      }
      await expectNoPercentages(page);
    });
  }

  async function expectNoPercentages(page: Page): Promise<void> {
    const text = await page.locator("body").innerText();
    const found = [...text.matchAll(/\b\d{1,3}\s?%/g)]
      .map((match) =>
        text.slice(Math.max(0, match.index - 30), match.index + 20).replace(/\s+/g, " "),
      )
      .filter((context) => !ALLOWED.some((allowed) => allowed.test(context)));
    expect(found).toEqual([]);
    expect(text).not.toMatch(/confiden[a-z]*[^.\n]{0,40}\d/i);
  }
});

test.describe("copy punctuation", () => {
  // Our copy uses no semicolons and no arrows. Code, console output and text written by the
  // model or by people (marked data-written-text) are shown as they are.
  async function expectNoSemicolonsOrArrows(page: Page): Promise<void> {
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
    expect(offending).toEqual([]);
  }

  for (const route of ROUTES) {
    test(`${route} has no semicolons or arrows in its copy`, async ({ page }) => {
      await page.goto(route);
      await settle(page);
      await expectNoSemicolonsOrArrows(page);
      if (!CHANGE_IDS.some((id) => route === `/changes/${id}`)) return;
      for (const name of STEP_TABS) {
        await page.getByRole("tab", { name }).click();
        await expectNoSemicolonsOrArrows(page);
      }
    });
  }
});
