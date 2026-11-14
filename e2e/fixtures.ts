import { expect, test as base } from "@playwright/test";

/**
 * Playwright `test` that fails when the page logs a console error or warning,
 * or throws an uncaught exception. The demo path must have a clean console
 * (`.claude/rules/quality.md`); e2e runs the production build, so Next.js
 * dev-only messages never appear.
 */
export const test = base.extend<{ consoleProblems: string[] }>({
  consoleProblems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("console", (message) => {
        if (message.type() !== "error" && message.type() !== "warning") return;
        problems.push(`${message.type()}: ${message.text()} (${message.location().url})`);
      });
      page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));

      await use(problems);

      // Asserted after the test body so the failure lists every message, not just the first.
      expect(problems, `Browser console problems:\n${problems.join("\n")}`).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
