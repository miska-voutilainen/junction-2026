/**
 * Reads the text `dotnet test` prints: which test methods passed and failed,
 * whether the run built, and a short, stable form of the output for the review.
 * Pure string work, so the rules are unit-tested without .NET. Spec section 6, A5.
 */
import { TEST_OUTPUT_MAX_CHARS } from "../../policy/differentialTests";

/** What happened to one requested test method in a run. "missing": the run never reported it. */
export type MethodResult = "pass" | "fail" | "missing";

/** The run's overall result. "error": nothing can be said (build error, no matching test, timeout). */
export type RunResult = "pass" | "fail" | "error";

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
  const reported = [...output.matchAll(/^\s+(Passed|Failed) (.+?) \[[^\]]*\]\s*$/gm)].map(
    (match) => ({ name: match[2], didFail: match[1] === "Failed" }),
  );
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
  const withoutArguments = reportedName.replace(/\(.*$/, "");
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
  const lines = [...output.matchAll(/Failed: +(\d+), Passed: +(\d+)/g)].map((match) => [
    Number(match[1]),
    Number(match[2]),
  ]);
  const blocks = [...output.matchAll(/^Total tests: +\d+/gm)];
  if (lines.length === 0 && blocks.length === 0) return "error";
  const failed = sumOf(output, /^\s+Failed: +(\d+)\s*$/gm) + lines.reduce((sum, [n]) => sum + n, 0);
  const passed =
    sumOf(output, /^\s+Passed: +(\d+)\s*$/gm) + lines.reduce((sum, [, n]) => sum + n, 0);
  if (failed > 0) return "fail";
  return exitCode === 0 && passed > 0 ? "pass" : "error";
}

function sumOf(output: string, pattern: RegExp): number {
  return [...output.matchAll(pattern)].reduce((sum, match) => sum + Number(match[1]), 0);
}

/**
 * The first MSBuild error line, which ends in the project it came from:
 * "A.cs(3,1): error CS0246: The type 'Foo' was not found [C:\x\Tests.csproj]".
 * Only these lines count: a test's assertion text can contain "error CS" too.
 */
export function buildErrorLine(output: string): string | null {
  const line = output
    .split(/\r?\n/)
    .find((candidate) => /error (CS|MSB|NU|NETSDK)\d+:.*\[[^\]]+\.csproj\]\s*$/.test(candidate));
  return line === undefined ? null : line.trim();
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
    (text, dir) => text.replace(new RegExp(`${escapeRegExp(dir)}(?![\\w.-])`, "g"), "<worktree>"),
    output,
  );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Removes durations ("Duration: 376 ms", "[6 ms]", "[< 1 ms]", "[1 m 5 s]",
 * "Time Elapsed 00:00:35.79", "Total time: 2.7 Seconds", the "[xUnit.net 00:00:00.47]" prefix), which change on every run: the same result must
 * record the same bytes, so a replay can be compared with the recording.
 */
export function withoutTimings(output: string): string {
  return output
    .replace(/, Duration: [^-\n]*?(?= - )/g, "")
    .replace(/ \[(?:< ?)?[\d.,]+ ?(?:ms|s|m)(?: [\d.,]+ ?(?:ms|s))?\]/g, "")
    .replace(/^Time Elapsed .*$/gm, "")
    .replace(/^\s*Total time: .*$/gm, "")
    .replace(/\[xUnit\.net \d+:\d+:\d+(?:\.\d+)?\]/g, "[xUnit.net]");
}

/**
 * Lines that push a failure out of the kept tail without helping a reader:
 * restore and build progress, warnings, frames of the test framework and the
 * SDK, and a restore note that depends on what the NuGet cache held.
 */
const outputNoise = new RegExp(
  [
    ": warning ",
    "^\\s+Restored ",
    "Determining projects",
    "All projects are up-to-date for restore",
    "^\\s+\\S+ -> ",
    "^\\s+at (Microsoft|System|Xunit)\\.",
    "--- End of stack trace",
    // The xUnit runner repeats progress and failures that the console logger prints again, in an order that changes from run to run.
    "^\\[xUnit\\.net\\]",
    // Printed on stderr, so its place next to the totals changes from run to run.
    "^Test Run (Failed|Successful)\\.$",
  ].join("|"),
);

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
  const lines = output.split(/\r?\n/).filter((line) => !outputNoise.test(line));
  const excerpt = testExcerpt(
    lines.map((line) =>
      line.length > MAX_EXCERPT_LINE_CHARS ? `${line.slice(0, MAX_EXCERPT_LINE_CHARS)}…` : line,
    ),
  );
  const text = (excerpt ?? lines.join("\n")).trim();
  if (text.length <= TEST_OUTPUT_MAX_CHARS) return text;
  return excerpt === null
    ? text.slice(-TEST_OUTPUT_MAX_CHARS)
    : `${text.slice(0, TEST_OUTPUT_MAX_CHARS - 1)}…`;
}

/** The excerpt described above, or null when the output has no test result lines. */
function testExcerpt(lines: readonly string[]): string | null {
  const isResult = (line: string) => /^\s+(Passed|Failed) \S/.test(line);
  const isSummary = (line: string) =>
    /^Total tests: /.test(line) ||
    /^\s+(Passed|Failed|Skipped): +\d+\s*$/.test(line) ||
    /^(Passed|Failed)!\s+- Failed:/.test(line);
  const failedStarts = lines.flatMap((line, index) => (/^\s+Failed \S/.test(line) ? [index] : []));
  const passed = lines.filter((line) => /^\s+Passed \S/.test(line));
  const summary = lines.filter(isSummary);
  if (failedStarts.length === 0 && passed.length === 0) return null;
  const failures = failedStarts.map((start) => {
    const end = lines.findIndex(
      (line, index) => index > start && (isResult(line) || isSummary(line)),
    );
    return failureExcerpt(lines.slice(start, end === -1 ? lines.length : end));
  });
  return [...(failedStarts.length > 0 ? failures : passed), "", ...summary].join("\n");
}

/** One failed test: its name, the start of its error message and its first repository frames. */
function failureExcerpt(block: readonly string[]): string {
  const messageStart = block.findIndex((line) => /^\s+Error Message:/.test(line));
  const stackStart = block.findIndex((line) => /^\s+Stack Trace:/.test(line));
  const message =
    messageStart === -1
      ? []
      : block
          .slice(messageStart, stackStart === -1 ? block.length : stackStart)
          .filter((line) => line.trim() !== "" && !/^\s+at /.test(line)); // frames inside the message are counted below
  const frames = block
    .filter((line) => /^\s+at .*<worktree>[\\/](src|tests)[\\/]/.test(line))
    .slice(0, MAX_REPOSITORY_FRAMES);
  return [block[0], ...message.slice(0, 1 + MAX_MESSAGE_LINES), ...frames].join("\n");
}
