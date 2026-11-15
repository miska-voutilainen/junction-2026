/**
 * Turns the diff between two commits into the review's reading units: files,
 * and hunks with stable ids (h1, h2, ... in diff order). Every later step
 * (claims, findings, routing, the hunk map) points at these ids, so they come
 * from one deterministic parse of git's own output. Spec section 5, Review.
 */
import parseDiff, { type Change } from "parse-diff";
import type { Review } from "../../contracts";
import { classifyFile } from "../../policy/areas";
import { computeDiffIdentity, pinnedDiffArgs } from "./diffIdentity";
import { runGit } from "./runGit";

/** The `diff`, `files` and `hunks` parts of a Review. */
export interface LoadedDiff {
  diff: Review["diff"];
  files: Review["files"];
  hunks: Review["hunks"];
}

/** Context lines around each change, git's default. */
const contextLines = 3;

/**
 * Loads the diff from `baseSha` to `headSha` in the clone at `repoDir`.
 *
 * @throws Error when git fails, e.g. a SHA is missing from the clone (run pnpm seed).
 */
export async function loadDiff(
  repoDir: string,
  baseSha: string,
  headSha: string,
): Promise<LoadedDiff> {
  const [identity, rawDiff] = await Promise.all([
    computeDiffIdentity(repoDir, baseSha, headSha),
    runGit(repoDir, pinnedDiffArgs(baseSha, headSha, [`-U${contextLines}`]), { isolated: true }),
  ]);
  const { files, hunks } = parseUnifiedDiff(rawDiff.toString("utf8"), `${baseSha}..${headSha}`);
  return {
    diff: {
      baseSha,
      headSha,
      ...identity,
      filesChanged: files.length,
      linesAdded: files.reduce((sum, file) => sum + file.added, 0),
      linesRemoved: files.reduce((sum, file) => sum + file.removed, 0),
    },
    files,
    hunks,
  };
}

/**
 * Parses unified diff text (git diff output without renames) into files and
 * hunks. Pure, so tests can run it on committed .diff fixtures without a clone.
 * Binary files appear as files with no hunks.
 *
 * @param range only used in the error message, e.g. "<base>..<head>"
 * @throws Error when an entry has no file path, rather than dropping it and
 *   showing less than the hashed diff.
 */
export function parseUnifiedDiff(
  diffText: string,
  range = "the diff",
): Pick<LoadedDiff, "files" | "hunks"> {
  const files: Review["files"] = [];
  const hunks: Review["hunks"] = [];

  for (const [index, parsedFile] of parseDiff(diffText).entries()) {
    // A deleted file's `to` is /dev/null; its path is the old name.
    const path = parsedFile.deleted ? parsedFile.from : parsedFile.to;
    if (!path || path === "/dev/null") {
      throw new Error(
        `No file path in diff entry ${index + 1} (from=${parsedFile.from}, to=${parsedFile.to}) for ${range}; check the clone's diff config.`,
      );
    }
    const hunkIds: string[] = [];

    for (const chunk of parsedFile.chunks) {
      const id = `h${hunks.length + 1}`;
      hunkIds.push(id);
      hunks.push({
        id,
        file: path,
        header: hunkHeader(chunk.content),
        oldStart: chunk.oldStart,
        oldLines: chunk.oldLines,
        newStart: chunk.newStart,
        newLines: chunk.newLines,
        // "\ No newline at end of file" is a note about the line before it, not a line.
        lines: chunk.changes.filter((change) => !change.content.startsWith("\\")).map(toHunkLine),
      });
    }

    files.push({
      path,
      ...classifyFile(path),
      added: parsedFile.additions,
      removed: parsedFile.deletions,
      hunkIds,
    });
  }
  return { files, hunks };
}

type HunkLine = Review["hunks"][number]["lines"][number];

function toHunkLine(change: Change): HunkLine {
  const text = change.content.slice(1);
  if (change.type === "add") return { kind: "add", oldLine: null, newLine: change.ln, text };
  if (change.type === "del") return { kind: "del", oldLine: change.ln, newLine: null, text };
  return { kind: "context", oldLine: change.ln1, newLine: change.ln2, text };
}

/** "@@ -236,7 +236,7 @@ class Foo" becomes "@@ -236,7 +236,7 @@": the section name after the ranges is dropped. */
function hunkHeader(chunkLine: string): string {
  return /^@@ [^@]+ @@/.exec(chunkLine)?.[0] ?? chunkLine;
}
