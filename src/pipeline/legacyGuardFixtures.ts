/**
 * Test doubles shared by the legacy guard's tests: a hunk builder and a fake
 * base commit that stands in for git, so detectors run without a clone.
 */
import type { Review } from "../contracts";
import type { BaseTree } from "../lib/git/baseTree";
import { findLegacyTouchPoints } from "./legacyTouchPoints";

export type Hunk = Review["hunks"][number];

export function hunk(
  id: string,
  file: string,
  lines: Array<["add" | "del" | "context", string]>,
): Hunk {
  return {
    id,
    file,
    header: "@@ -1,1 +1,1 @@",
    oldStart: 1,
    oldLines: 1,
    newStart: 1,
    newLines: 1,
    lines: lines.map(([kind, text]) => ({ kind, text, oldLine: null, newLine: null })),
  };
}

export function fileOf(path: string): Review["files"][number] {
  return { path, kind: "source", area: null, added: 1, removed: 0, hunkIds: [] };
}

/**
 * A base commit as the detectors see it: `mentions` are test files per word,
 * `zoneMentions` zone files per word, `zoneSymbols` what the zones declare,
 * `outsideSymbols` the src files outside the zones declaring each name, and
 * `files` the files (csproj) at base. Nothing is read from git.
 */
export function fakeTree(
  parts: {
    mentions?: Record<string, string[]>;
    zoneMentions?: Record<string, string[]>;
    zoneSymbols?: Record<string, string>;
    outsideSymbols?: Record<string, string[]>;
    files?: Record<string, string>;
  } = {},
): BaseTree {
  const files = parts.files ?? {};
  const declaration = (name: string, path: string) => ({
    path,
    text: `public void ${name}(int a)`,
  });
  return {
    filesMentioning: async (word, pathspecs) =>
      (pathspecs[0] === "tests" ? parts.mentions?.[word] : parts.zoneMentions?.[word]) ?? [],
    // The whole of src/ is asked for when looking for declarations outside the zones.
    accessModifierLines: async (pathspecs) =>
      pathspecs[0] === ":(glob)src/**/*.cs"
        ? Object.entries(parts.outsideSymbols ?? {}).flatMap(([name, paths]) =>
            paths.map((path) => declaration(name, path)),
          )
        : Object.entries(parts.zoneSymbols ?? {}).map(([name, path]) => declaration(name, path)),
    readFile: async (path) => files[path] ?? null,
    listFiles: async () => Object.keys(files),
  };
}

export const find = (hunks: Hunk[], tree: BaseTree, changedPaths: string[] = []) =>
  findLegacyTouchPoints({ repoDir: "", baseSha: "", files: changedPaths.map(fileOf), hunks }, tree);
