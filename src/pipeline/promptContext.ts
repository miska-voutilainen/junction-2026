/**
 * What the model reads about a change: the hunks with their ids, and the head-side
 * text of the touched files, each line prefixed with its number so the model can
 * cite lines and the quote check can find them again. Untrusted text (code, diff)
 * sits in delimited blocks. Every line of it starts with a line number or a +/-
 * marker, so no line can equal a closing tag and end a block early. That is all
 * the layout guarantees: text that reads like an instruction still reaches the
 * model, which the system text tells to treat the blocks as data. Spec 9.1, T12.
 */
import type { FileKind, Requirement, Review } from "../contracts";

type Hunk = Review["hunks"][number];
type ReviewFile = Review["files"][number];

/** Token budget for file text in one A2 prompt (spec section 6, A2). */
export const FILE_TOKEN_BUDGET = 60_000;

/** Rough size of a token in characters; good enough to decide whether to cut, and needs no tokenizer. */
export const CHARS_PER_TOKEN = 4;

/** Lines kept above and below each hunk when files are cut: enough to show the enclosing method and its neighbours. */
export const LINES_AROUND_HUNK = 80;

/** Kinds whose full text is sent; docs send only hunks, generated only the path (spec 9.1, T12). */
const KINDS_WITH_FILE_TEXT: ReadonlySet<FileKind> = new Set(["source", "test"]);

/** One line explaining the hunk line layout; A2 and A3 print it above the hunks block. */
export const HUNK_LINE_LEGEND =
  "Hunk lines read: old line number, new line number, then + added, - removed or a space for unchanged, then the text. A dot means the line has no number on that side.";

/** Every item of a requirement, functional first: the list the prompts and the id checks walk. */
export function requirementItems(requirement: Requirement): Requirement["functional"] {
  return [...requirement.functional, ...requirement.nonFunctional];
}

/**
 * The requirement as the delimited block every prompt embeds.
 *
 * @example a requirement MP-2283 with one item F1 renders as the lines
 * `<requirement id="MP-2283">`, `Title: ...`, `Intent: ...`, `Items:`, `F1: ...`, `</requirement>`.
 */
export function requirementBlock(requirement: Requirement): string {
  const items = requirementItems(requirement)
    .map((item) => `${item.id}: ${item.text}`)
    .join("\n");
  return `<requirement id="${requirement.id}">\nTitle: ${requirement.title}\nIntent: ${requirement.intent}\nItems:\n${items}\n</requirement>`;
}

/** The blocks A2's prompt embeds. */
export interface PromptContext {
  hunksBlock: string;
  filesBlock: string;
  /** True when the 60,000-token budget forced the files to be cut around the hunks. */
  wasCut: boolean;
}

/** Inputs for {@link buildPromptContext}. */
export interface PromptContextInput {
  files: readonly ReviewFile[];
  hunks: readonly Hunk[];
  /** Head-side text by path. A path is absent when the file is deleted by the change. */
  headTexts: ReadonlyMap<string, string>;
}

/** Builds the hunks and files blocks, cutting file text when it would pass the token budget. */
export function buildPromptContext({ files, hunks, headTexts }: PromptContextInput): PromptContext {
  const shown = files.filter(
    (file) => KINDS_WITH_FILE_TEXT.has(file.kind) && headTexts.has(file.path),
  );
  const totalChars = shown.reduce((sum, file) => sum + (headTexts.get(file.path) ?? "").length, 0);
  const wasCut = totalChars / CHARS_PER_TOKEN > FILE_TOKEN_BUDGET;

  const fileBlocks = shown.map((file) => {
    const text = headTexts.get(file.path) ?? "";
    const fileHunks = hunks.filter((hunk) => hunk.file === file.path);
    return fileBlock(file, numberedLines(text, wasCut ? keptRanges(fileHunks) : null));
  });
  const generated = files.filter((file) => file.kind === "generated").map(generatedLine);

  return {
    hunksBlock: hunks
      .filter((hunk) => files.find((file) => file.path === hunk.file)?.kind !== "generated")
      .map(hunkBlock)
      .join("\n"),
    filesBlock: [...fileBlocks, ...(generated.length > 0 ? [generatedBlock(generated)] : [])].join(
      "\n",
    ),
    wasCut,
  };
}

/** One hunk: old line, new line, then `+`, `-` or a space, then the text. A dot means no number on that side. */
function hunkBlock(hunk: Hunk): string {
  const lines = hunk.lines.map((line) => {
    const marker = line.kind === "add" ? "+" : line.kind === "del" ? "-" : " ";
    return `${lineNumber(line.oldLine)} ${lineNumber(line.newLine)} ${marker} ${line.text}`;
  });
  return [
    `<hunk id="${hunk.id}" file="${hunk.file}" header="${hunk.header}">`,
    ...lines,
    "</hunk>",
  ].join("\n");
}

function lineNumber(value: number | null): string {
  return value === null ? "    ." : String(value).padStart(5);
}

function fileBlock(file: ReviewFile, body: string): string {
  return `<file path="${file.path}" kind="${file.kind}" side="head">\n${body}\n</file>`;
}

function generatedLine(file: ReviewFile): string {
  return `${file.path} (hunks ${file.hunkIds.join(", ")}; +${file.added} -${file.removed})`;
}

function generatedBlock(lines: string[]): string {
  return `<generated-files note="content not shown">\n${lines.join("\n")}\n</generated-files>`;
}

/** Inclusive 1-based line ranges to keep. */
interface LineRange {
  from: number;
  to: number;
}

/** The ranges around each hunk's new-side lines, merged where they touch. */
function keptRanges(fileHunks: readonly Hunk[]): LineRange[] {
  const sorted = fileHunks
    .map((hunk) => ({
      from: Math.max(1, hunk.newStart - LINES_AROUND_HUNK),
      to: hunk.newStart + Math.max(hunk.newLines, 1) - 1 + LINES_AROUND_HUNK,
    }))
    .sort((a, b) => a.from - b.from);
  const merged: LineRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.from <= last.to + 1) last.to = Math.max(last.to, range.to);
    else merged.push({ ...range });
  }
  return merged;
}

/**
 * Prefixes each line with its number ("  12| code"). With `ranges`, lines outside
 * them are replaced by "… (lines a–b omitted)", so the numbers stay true.
 */
function numberedLines(text: string, ranges: readonly LineRange[] | null): string {
  const lines = text.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
  const numbered = (index: number) => `${String(index + 1).padStart(5)}| ${lines[index]}`;
  if (ranges === null) return lines.map((_, index) => numbered(index)).join("\n");

  const output: string[] = [];
  let next = 1;
  for (const range of ranges) {
    const to = Math.min(range.to, lines.length);
    if (range.from > next) output.push(omitted(next, range.from - 1));
    for (let line = Math.max(range.from, next); line <= to; line++) output.push(numbered(line - 1));
    next = Math.max(next, to + 1);
  }
  if (next <= lines.length) output.push(omitted(next, lines.length));
  return output.join("\n");
}

function omitted(from: number, to: number): string {
  return `… (lines ${from}–${to} omitted)`;
}
