import path from "node:path";
import type { Review } from "../contracts";

type Hunk = Review["hunks"][number];

/**
 * The hunks whose file matches a claim's `pathGlob`: Node's own matcher on
 * repo-relative forward-slash paths (spec 9.1, T12), so the model writes the
 * globs it knows from the shell.
 *
 * @example hunksMatchingGlob("tests/**\/Resources/**", hunks) // every snapshot hunk
 */
export function hunksMatchingGlob(glob: string, hunks: readonly Hunk[]): Hunk[] {
  return hunks.filter((hunk) => path.posix.matchesGlob(hunk.file, glob));
}
