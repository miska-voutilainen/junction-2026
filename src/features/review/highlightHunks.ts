/**
 * Syntax highlighting for the diff, run in server components so the browser
 * ships no highlighter. The page is statically generated, so for the committed
 * changes that means once at build time. Each hunk is tokenised on its own, as
 * the spec says (section 3, S2 diff viewer): a hunk is a few dozen lines, and a
 * wrong guess at the grammar state at its first line costs at most one
 * mis-coloured token. Colours are CSS variables defined in `globals.css`, so
 * they follow the design tokens instead of a stock theme.
 */
import "server-only";
import { codeToTokensBase, createCssVariablesTheme } from "shiki";
import type { Review } from "@/contracts";

/** A piece of one line with its colour as a CSS value; `color` is absent for plain text. */
export interface CodeToken {
  content: string;
  color?: string;
}

/** Tokens per hunk id, then per line of the hunk (same order as `hunk.lines`). */
export type HighlightedHunks = Record<string, CodeToken[][]>;

const theme = createCssVariablesTheme({ name: "countersign", variablePrefix: "--shiki-", fontStyle: false });

/**
 * Tokenises every C# hunk of a review. Hunks of other file types come back
 * as one plain token per line.
 */
export async function highlightHunks(hunks: Review["hunks"]): Promise<HighlightedHunks> {
  const entries = await Promise.all(hunks.map(async (hunk) => [hunk.id, await tokenise(hunk)] as const));
  return Object.fromEntries(entries);
}

async function tokenise(hunk: Review["hunks"][number]): Promise<CodeToken[][]> {
  if (!hunk.file.endsWith(".cs")) return hunk.lines.map((line) => [{ content: line.text }]);
  const lines = await codeToTokensBase(hunk.lines.map((line) => line.text).join("\n"), { lang: "csharp", theme });
  return lines.map((line) => line.map(({ content, color }) => ({ content, color })));
}
