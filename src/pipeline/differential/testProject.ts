/**
 * Finds what A5 and the test runner need in the change: which test project it
 * touches, which existing test file shows the house style, and which test
 * methods the PR itself added or changed. Plain path and text rules, no model.
 */
import type { Review } from "../../contracts";
import { PR_TEST_NAMES_MAX } from "../../policy/differentialTests";

type ReviewFile = Review["files"][number];
type Hunk = Review["hunks"][number];

/**
 * The test project folder the change touches: the first two path segments of its
 * first changed test or test-resource file under `tests/`, or null when the
 * change touches no test project (A5 then has nowhere to put a test).
 *
 * @example testProjectDir([{ path: "tests/X.Tests/A.cs", ... }]) // "tests/X.Tests"
 */
export function testProjectDir(files: readonly ReviewFile[]): string | null {
  const touched = files.find(
    (file) =>
      /^tests\/[^/]+\//.test(file.path) && (file.kind === "test" || file.kind === "generated"),
  );
  return touched === undefined ? null : touched.path.split("/").slice(0, 2).join("/");
}

/** Test files the PR adds or changes: the source of the PR's own tests. Generated expected outputs are not tests. */
export function prTestFiles(files: readonly ReviewFile[]): ReviewFile[] {
  return files.filter((file) => file.kind === "test" && file.path.endsWith(".cs"));
}

/**
 * Picks one existing test file of the project as A5's style example: a test file
 * the PR changes and that exists on the base, else the first `*Tests.cs` of the
 * project folder. A file the PR changes is the likeliest to show the idiom for
 * the code under review.
 *
 * @param basePaths every repository path on the base side
 * @returns the path, or null when the project has no test file on the base
 */
export function chooseStyleExample(
  projectDir: string,
  basePaths: readonly string[],
  changedTestFiles: readonly ReviewFile[],
): string | null {
  const onBase = new Set(basePaths);
  const changed = changedTestFiles.find((file) => onBase.has(file.path));
  if (changed !== undefined) return changed.path;
  const inProject = basePaths
    .filter((path) => path.startsWith(`${projectDir}/`) && path.endsWith("Tests.cs"))
    // Ordinal, not locale order: the same style example on every machine keeps A5's prompt, and so its recording key, stable.
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return inProject[0] ?? null;
}

const testAttribute = /^\s*\[(Fact|Theory|Test|TestMethod)\b/;
const methodDeclaration = /\b(?:async\s+)?(?:Task|ValueTask|void)\s+(\w+)\s*\(/;

/**
 * Names of the test methods of a head-side file that have an added line: a new
 * test, or a test whose body the PR changed. A method's region runs from its
 * `[Fact]` or `[Theory]` line to its closing brace (or to the next test when the
 * braces do not balance), so a helper added after an unchanged test does not
 * count that test as changed.
 */
export function changedTestMethods(
  headText: string,
  hunks: readonly Hunk[],
  file: string,
): string[] {
  const addedLines = new Set(
    hunks
      .filter((hunk) => hunk.file === file)
      .flatMap((hunk) => hunk.lines)
      .filter((line) => line.kind === "add" && line.newLine !== null)
      .map((line) => line.newLine as number),
  );
  const lines = headText.replace(/\r\n/g, "\n").split("\n");
  const starts = lines.flatMap((line, index) => (testAttribute.test(line) ? [index] : []));
  return starts.flatMap((start, position) => {
    const end = methodEnd(lines, start, starts[position + 1] ?? lines.length);
    const isChanged = [...addedLines].some((number) => number - 1 >= start && number - 1 < end);
    const name = isChanged ? methodName(lines.slice(start, end)) : null;
    return name === null ? [] : [name];
  });
}

/** The name of the first test method of a file, or null: one of the repository's own tests. */
export function firstTestMethod(text: string): string | null {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((line) => testAttribute.test(line));
  return start === -1 ? null : methodName(lines.slice(start));
}

/** The line after the method's closing brace, or `limit` when the braces never balance before it. */
function methodEnd(lines: readonly string[], start: number, limit: number): number {
  let depth = 0;
  let hasOpened = false;
  for (let index = start; index < limit; index++) {
    for (const character of lines[index]) {
      if (character === "{") {
        depth += 1;
        hasOpened = true;
      } else if (character === "}") depth -= 1;
    }
    if (hasOpened && depth <= 0) return index + 1;
  }
  return limit;
}

function methodName(region: readonly string[]): string | null {
  for (const line of region) {
    const match = methodDeclaration.exec(line);
    if (match !== null) return match[1];
  }
  return null;
}

/** The names of all PR test methods, without repeats and capped, ready for a `--filter`. */
export function limitTestNames(names: readonly string[]): string[] {
  return [...new Set(names)].slice(0, PR_TEST_NAMES_MAX);
}
