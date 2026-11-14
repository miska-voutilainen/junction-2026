import { expect, test } from "@playwright/test";
import { bypassVercelAuth } from "./bypassVercelAuth";

// The shell: the Ctrl+K menu's position, the navigation sheet below 900 px and the pinned side nav.

test.beforeEach(async ({ page }) => {
  await bypassVercelAuth(page);
});

test.describe("command menu position", () => {
  test("opens near the top and stays fully visible", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Control+k");
    const box = await page.getByRole("dialog").boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeLessThanOrEqual(900 * 0.2);
    expect(box!.y + box!.height).toBeLessThanOrEqual(900);
  });

  test("on a short window the menu fits and its list scrolls inside", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 480 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Control+k");
    const box = await page.getByRole("dialog").boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(480);
  });
});

test.describe("navigation sheet", () => {
  for (const width of [375, 800]) {
    test(`at ${width} px opens, traps focus, marks the page, navigates and closes on Esc`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      const menuButton = page.getByRole("button", { name: "Open navigation" }).locator("visible=true");
      const box = await menuButton.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);

      await menuButton.click();
      const sheet = page.getByRole("dialog", { name: "Navigation" });
      await expect(sheet).toBeVisible();
      await expect(sheet.getByRole("link", { name: /Inbox/ })).toHaveAttribute("aria-current", "page");
      await expect(sheet.getByText("Insights")).toBeVisible();

      // Focus stays inside the sheet however many times Tab is pressed.
      for (let press = 0; press < 8; press++) {
        await page.keyboard.press("Tab");
        expect(await sheet.evaluate((node) => node.contains(document.activeElement))).toBe(true);
      }

      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden();
      await expect(menuButton).toBeFocused();

      await menuButton.click();
      await page.getByRole("dialog", { name: "Navigation" }).getByRole("link", { name: "Dashboard" }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByRole("dialog", { name: "Navigation" })).toBeHidden();
    });
  }

  test("closes on a click on the backdrop", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Open navigation" }).locator("visible=true").click();
    const sheet = page.getByRole("dialog", { name: "Navigation" });
    await expect(sheet).toBeVisible();
    // A click while the sheet is still sliding in does not dismiss it, so wait for the animation to end.
    await sheet.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));
    await page.mouse.click(360, 400);
    await expect(page.getByRole("dialog", { name: "Navigation" })).toBeHidden();
  });

  test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("opens without a slide", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "Open navigation" }).locator("visible=true").click();
      await expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible();
      const running = await page.evaluate(() =>
        document.getAnimations().filter((animation) => animation.playState === "running").length,
      );
      expect(running).toBe(0);
    });
  });
});

test("the keyboard shortcuts control stays on screen before and after scrolling to the bottom", async ({ page, isMobile }) => {
  test.skip(isMobile, "the side nav exists from 900 px");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/changes/mp-2283");
  await page.waitForLoadState("networkidle");
  const shortcuts = page.getByRole("button", { name: "Keyboard shortcuts" });
  await expect(shortcuts).toBeInViewport();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(shortcuts).toBeInViewport();
});
