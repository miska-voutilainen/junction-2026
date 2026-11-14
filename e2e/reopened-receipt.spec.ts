import { expect, test } from "@playwright/test";
import { bypassVercelAuth } from "./bypassVercelAuth";

// On the fixtures mp-2283 is signed, and its two Generator hunks were covered by tests when it was signed.
const REOPENED = "Reopened by an escape";
const REOPENED_LINE =
  "An escape in Generator re-routed this change after it was signed: 2 hunks the signer didn't read now need a person.";
const shot = (name: string, projectName: string) =>
  `.review/reopened-${name}-${projectName === "mobile" ? 375 : 1440}.png`;

test.beforeEach(async ({ page }) => {
  await bypassVercelAuth(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("an escape reopens the signed change on S1, S2 and S4, and Reset clears it", async ({
  page,
}, testInfo) => {
  await page.goto("/changes/mp-2283");
  await expect(page.getByText(REOPENED)).toHaveCount(0);

  await page.goto("/reviewer");
  await page
    .getByRole("article", { name: "Generator" })
    .getByRole("button", { name: "Record escape" })
    .click();
  await expect(page.getByText("Escape recorded (simulated)")).toBeVisible();

  await page.goto("/");
  // The inbox renders a table row and a stacked row; only one is visible per viewport.
  await expect(page.getByText(REOPENED).locator("visible=true").first()).toBeVisible();
  await page.screenshot({ path: shot("s1", testInfo.project.name) });

  await page.goto("/changes/mp-2283");
  await expect(page.getByText(REOPENED_LINE)).toBeVisible();
  await expect(page.getByText(REOPENED, { exact: true })).toBeVisible();
  await page.screenshot({ path: shot("s2", testInfo.project.name) });

  await page.goto("/changes/mp-2283/receipt");
  await expect(page.getByText(REOPENED_LINE)).toBeVisible();
  await expect(page.getByText("Signature valid · diff unchanged")).toBeVisible();

  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByText(REOPENED_LINE)).toBeHidden();
  await page.goto("/changes/mp-2283");
  await expect(page.getByText(REOPENED)).toHaveCount(0);
  await page.goto("/");
  await expect(page.getByText(REOPENED)).toHaveCount(0);
});
