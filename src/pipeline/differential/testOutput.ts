/**
 * Reads the text `dotnet test` prints: which test methods passed and failed,
 * whether the run built, and a short, stable form of the output for the review.
 * Pure string work, so the rules are unit-tested without .NET. Spec section 6, A5.
 *
 * The text comes from model-written tests, so a line can be any length and any
 * content. Lines are therefore read with startsWith, indexOf and trim, not with
 * regular expressions that have two adjacent quantified parts: those can take
 * quadratic time on a long adversarial line.
 */
import { TEST_OUTPUT_MAX_CHARS } from "../../policy/differentialTests";

/** What happened to one requested test method in a run. "missing": the run never reported it. */
export type MethodResult = "pass" | "fail" | "missing";

/** The run's overall result. "error": nothing can be said (build error, no matching test, timeout). */
export type RunResult = "pass" | "fail" | "error";

/** The text of an indented line without its indent, or null when the line has no indent. */
function indented(line: string): string | null {
  const text = line.trimStart();
  return text.length < line.length ? text : null;
}

/** The text after "<word> " on an indented line ("  Failed Name [6 ms]"), or null. */
function afterResultWord(line: string, word: "Passed" | "Failed"): string | null {
  const text = indented(line);
  if (text === null || !text.startsWith(`${word} `)) return null;
  const rest = text.slice(word.length + 1);
  return rest === "" || rest.startsWith(" ") ? null : rest;
}

/** The number in an indented count line ("     Failed: 2"), or null. */
function countOf(line: string, label: string): number | null {
  const text = indented(line)?.trimEnd();
  if (text === undefined || !text.startsWith(`${label}: `)) return null;
  const digits = text.slice(label.length + 2).trimStart();
  return /^\d+$/.test(digits) ? Number(digits) : null;
}

/**
 * The result of each requested method, from the console logger's lines
 * ("  Failed Class.Method [6 ms]", "  Passed Class.Method(arg: 1) [< 1 ms]"). A
 * method with several results (a theory) fails when any row fails.
 *
 * @example parseMethodResults("  Failed A5Tests.A5_F1_X [6 ms]", ["A5_F1_X", "A5_F1_Y"])
 *   // { A5_F1_X: "fail", A5_F1_Y: "missing" }
 */
export function parseMethodResults(
  output: string,
  testNames: readonly string[],
): Record<string, MethodResult> {
  const reported = output.split(/\r?\n/).flatMap((line) => {
    const failedName = afterResultWord(line, "Failed");
    const name = failedName ?? afterResultWord(line, "Passed");
    const timing = name?.trimEnd();
    if (name === null || timing === undefined || !timing.endsWith("]")) return [];
    const timingStart = timing.lastIndexOf(" [");
    if (timingStart === -1) return [];
    return [{ name: timing.slice(0, timingStart), didFail: failedName !== null }];
  });
  const results: Record<string, MethodResult> = {};
  for (const method of testNames) {
    const own = reported.filter(({ name }) => isMethod(name, method));
    if (own.length === 0) results[method] = "missing";
    else results[method] = own.some(({ didFail }) => didFail) ? "fail" : "pass";
  }
  return results;
}

/** "A5Tests.A5_F1_X" and "Ns.A5Tests.A5_F1_X(arg: 1)" are the method A5_F1_X; "A5_F1_XY" is not. */
function isMethod(reportedName: string, method: string): boolean {
  const argumentsStart = reportedName.indexOf("(");
  const withoutArguments =
    argumentsStart === -1 ? reportedName : reportedName.slice(0, argumentsStart);
  return withoutArguments === method || withoutArguments.endsWith(`.${method}`);
}

/**
 * The run's overall result. A test summary line means the code built, so it
 * decides alone: an assertion message that happens to contain "error CS0103"
 * is a test failure, not a build error. Without a summary there is no verdict.
 *
 * Two summary formats exist: one line per target framework on a terminal
 * ("Failed!  - Failed:     1, Passed:     0, Skipped:     0, Total:     1"), and
 * a block in a container ("Total tests: 2" with indented "Passed: 1", "Failed: 1").
 */
export function classifyTestOutput(output: string, exitCode: number | null): RunResult {
  const lines = output.split(/\r?\n/);
  const terminal = lines.flatMap((line) => {
    const failed = numberAfter(line, "Failed: ");
    const passed = numberAfter(line, ", Passed: ");
    return failed === null || passed === null ? [] : [{ failed, passed }];
  });
  const hasBlock = lines.some((line) => line.startsWith("Total tests: "));
  if (terminal.length === 0 && !hasBlock) return "error";
  const sum = (label: "Passed" | "Failed") =>
    lines.reduce((total, line) => total + (countOf(line, label) ?? 0), 0);
  const failed = sum("Failed") + terminal.reduce((total, entry) => total + entry.failed, 0);
  const passed = sum("Passed") + terminal.reduce((total, entry) => total + entry.passed, 0);
  if (failed > 0) return "fail";
  return exitCode === 0 && passed > 0 ? "pass" : "error";
}

/** The whole number right after `label` in a line ("Failed:     1," after "Failed: "), skipping spaces, or null. */
function numberAfter(line: string, label: string): number | null {
  const at = line.indexOf(label.trim());
  if (at === -1) return null;
  const rest = line.slice(at + label.trim().length).trimStart();
  let digits = 0;
  while (digits < rest.length && rest[digits] >= "0" && rest[digits] <= "9") digits += 1;
  return digits === 0 ? null : Number(rest.slice(0, digits));
}

/**
 * The first MSBuild error line, which ends in the project it came from:
 * "A.cs(3,1): error CS0246: The type 'Foo' was not found [C:\x\Tests.csproj]".
 * Only these lines count: a test's assertion text can contain "error CS" too.
 */
export function buildErrorLine(output: string): string | null {
  const line = output.split(/\r?\n/).find(isBuildErrorLine);
  return line === undefined ? null : line.trim();
}

function isBuildErrorLine(line: string): boolean {
  if (!line.trimEnd().endsWith(".csproj]")) return false;
  const marker = line.startsWith("error ") ? 0 : line.indexOf(" error ") + 1;
  if (marker === 0 && !line.startsWith("error ")) return false;
  const code = line.slice(marker + "error ".length);
  return /^(CS|MSB|NU|NETSDK)\d+:/.test(code);
}

/**
 * Replaces the worktree's path with "<worktree>", in both slash styles. A host
 * path names the operator's home folder and has a random folder name, so a rerun
 * would write different bytes for the same result. A path that merely starts
 * with the same letters ("/workflow" for "/work") is left alone.
 *
 * @example withoutWorktreePath("at /work/tests/A.cs:line 9", "/work") // "at <worktree>/tests/A.cs:line 9"
 */
export function withoutWorktreePath(output: string, worktreeDir: string): string {
  const forward = worktreeDir.replaceAll("\\", "/");
  return [worktreeDir, forward].reduce(
    (text, dir) =>
      text.replace(new RegExp(String.raw`${escapeRegExp(dir)}(?![\w.-])`, "g"), "<worktree>"),
    output,
  );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/**
 * Removes durations ("Duration: 376 ms", "[6 ms]", "[< 1 ms]", "[1 m 5 s]",
 * "Time Elapsed 00:00:35.79", "Total time: 2.7 Seconds", the "[xUnit.net 00:00:00.47]"
 * prefix), which change on every run: the same result must record the same bytes,
 * so a replay can be compared with the recording.
 */
export function withoutTimings(output: string): string {
  return output
    .split(/\r?\n/)
    .filter(
      (line) => !line.startsWith("Time Elapsed ") && !line.trimStart().startsWith("Total time: "),
    )
    .map(withoutDuration)
    .join("\n")
    .replace(/ \[(?:< ?)?[\d.,]+ ?(?:ms|s|m)(?: [\d.,]+ ?(?:ms|s))?\]/g, "")
    .replace(/\[xUnit\.net \d+:\d+:\d+(?:\.\d+)?\]/g, "[xUnit.net]");
}

/** "..., Total: 1, Duration: 376 ms - Tests.dll" loses ", Duration: 376 ms"; found with indexOf so a long line stays linear. */
function withoutDuration(line: string): string {
  const start = line.indexOf(", Duration: ");
  if (start === -1) return line;
  const end = line.indexOf(" - ", start);
  return end === -1 ? line : line.slice(0, start) + line.slice(end);
}

/**
 * Lines that push a failure out of the kept excerpt without helping a reader:
 * restore and build progress, warnings, frames of the test framework and the
 * SDK, a restore note that depends on what the NuGet cache held, and lines the
 * runners print in an order that changes from run to run.
 */
function isNoise(line: string): boolean {
  if (line.includes(": warning ")) return true;
  if (line.includes("Determining projects")) return true;
  if (line.includes("All projects are up-to-date for restore")) return true;
  if (line.includes("--- End of stack trace")) return true;
  // The xUnit runner repeats progress and failures that the console logger prints again.
  if (line.startsWith("[xUnit.net]")) return true;
  // Printed on stderr, so its place next to the totals changes from run to run.
  if (line === "Test Run Failed." || line === "Test Run Successful.") return true;
  const text = indented(line);
  if (text === null) return false;
  if (text.startsWith("Restored ")) return true;
  if (["Microsoft", "System", "Xunit"].some((root) => text.startsWith(`at ${root}.`))) return true;
  // Build output "  Project -> path": one word, then an arrow.
  const firstSpace = text.indexOf(" ");
  return firstSpace > 0 && text.startsWith(" -> ", firstSpace);
}

/** Most "Error Message:" lines kept per failed test: the exception type and the start of its message. */
const MAX_MESSAGE_LINES = 6;

/** Most repository frames kept per failed test: where the test and the code it reached are. */
const MAX_REPOSITORY_FRAMES = 4;

/** Longest line kept in an excerpt, so one huge diagnostic cannot use the whole budget. */
const MAX_EXCERPT_LINE_CHARS = 300;

/**
 * The review's form of a run's output, within TEST_OUTPUT_MAX_CHARS: for each
 * failed test its name, "Error Message:" (the exception and the start of its
 * message) and the first repository frames, then the summary; for a run without
 * failures the passed tests and the summary. Output with no test lines (a build
 * error, a timeout) keeps its last characters instead, where the error is.
 */
export function trimOutput(output: string): string {
  const lines = output.split(/\r?\n/).filter((line) => !isNoise(line));
  const excerpt = testExcerpt(
    lines.map((line) =>
      line.length > MAX_EXCERPT_LINE_CHARS ? `${line.slice(0, MAX_EXCERPT_LINE_CHARS)}…` : line,
    ),
  );
  const text = (excerpt ?? lines.join("\n")).trim();
  if (text.length <= TEST_OUTPUT_MAX_CHARS) return text;
  return excerpt === null
    ? tailFromWholeLine(text)
    : `${text.slice(0, TEST_OUTPUT_MAX_CHARS - 1)}…`;
}

/**
 * The last TEST_OUTPUT_MAX_CHARS characters, starting at a line start. A plain
 * slice usually begins mid-line, and the build error read from it then starts
 * mid-path ("ktree>/tests/…" in mp-2129's recorded reasons). One line with no
 * break in the kept part is returned as cut, since nothing whole remains.
 */
function tailFromWholeLine(text: string): string {
  const tail = text.slice(-TEST_OUTPUT_MAX_CHARS);
  const startsAtLine = text.at(-TEST_OUTPUT_MAX_CHARS - 1) === "\n";
  const firstBreak = tail.indexOf("\n");
  if (startsAtLine || firstBreak === -1) return tail;
  return tail.slice(firstBreak + 1);
}

function isResultLine(line: string): boolean {
  return afterResultWord(line, "Passed") !== null || afterResultWord(line, "Failed") !== null;
}

/** "Passed!" and "Failed!" are the same length, so one constant skips either word. */
const TERMINAL_WORD_LENGTH = "Passed!".length;

function isSummaryLine(line: string): boolean {
  if (line.startsWith("Total tests: ")) return true;
  if (["Passed", "Failed", "Skipped"].some((label) => countOf(line, label) !== null)) return true;
  const terminal = line.startsWith("Passed!") || line.startsWith("Failed!");
  return terminal && line.slice(TERMINAL_WORD_LENGTH).trimStart().startsWith("- Failed:");
}

/** The excerpt described above, or null when the output has no test result lines. */
function testExcerpt(lines: readonly string[]): string | null {
  const failedStarts = lines.flatMap((line, index) =>
    afterResultWord(line, "Failed") === null ? [] : [index],
  );
  const passed = lines.filter((line) => afterResultWord(line, "Passed") !== null);
  const summary = lines.filter(isSummaryLine);
  if (failedStarts.length === 0 && passed.length === 0) return null;
  const failures = failedStarts.map((start) => {
    const end = lines.findIndex(
      (line, index) => index > start && (isResultLine(line) || isSummaryLine(line)),
    );
    return failureExcerpt(lines.slice(start, end === -1 ? lines.length : end));
  });
  const shown = failedStarts.length > 0 ? failures : passed;
  return [...shown, "", ...summary].join("\n");
}

function startsAfterIndent(line: string, prefix: string): boolean {
  return indented(line)?.startsWith(prefix) ?? false;
}

/** A frame line inside the repository's own src or tests folder, in either slash style. */
function isRepositoryFrame(line: string): boolean {
  if (!startsAfterIndent(line, "at ")) return false;
  return ["src", "tests"].some(
    (folder) => line.includes(`<worktree>/${folder}/`) || line.includes(`<worktree>\\${folder}\\`),
  );
}

/** The "Error Message:" block of a failure, without blank lines and without the frames inside it. */
function messageLines(block: readonly string[]): string[] {
  const messageStart = block.findIndex((line) => startsAfterIndent(line, "Error Message:"));
  if (messageStart === -1) return [];
  const stackStart = block.findIndex((line) => startsAfterIndent(line, "Stack Trace:"));
  const messageEnd = stackStart === -1 ? block.length : stackStart;
  // Frames inside the message are counted with the others below.
  return block
    .slice(messageStart, messageEnd)
    .filter((line) => line.trim() !== "" && !startsAfterIndent(line, "at "));
}

/** One failed test: its name, the start of its error message and its first repository frames. */
function failureExcerpt(block: readonly string[]): string {
  const frames = block.filter(isRepositoryFrame).slice(0, MAX_REPOSITORY_FRAMES);
  return [block[0], ...messageLines(block).slice(0, 1 + MAX_MESSAGE_LINES), ...frames].join("\n");
}
