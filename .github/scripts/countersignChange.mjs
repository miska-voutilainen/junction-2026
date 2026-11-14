// Names the change a pull request is about, for the Countersign workflows. The PR body carries one
// line, `Countersign: <changeId>`, the same id the pipeline and the receipt CLI use; a manual run
// passes it as an input instead. A PR with neither is not an agent PR for a registered change, so the
// receipt gate and the review step skip it. An id with no change input is an error, not a skip:
// otherwise a typo would turn the merge gate off.
//
// Env: PR_BODY (through `env:`, never the shell line), INPUT_CHANGE_ID (manual runs), GITHUB_OUTPUT.
import { appendFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const CHANGE_LINE = /^Countersign:[ \t]*([A-Za-z0-9-]+)[ \t]*$/m;

// The id later becomes a path and a shell argument, so it is letters, digits and dashes only; a
// manual input like "../../package" would otherwise pass the existence check in main().
const CHANGE_ID = /^[A-Za-z0-9-]+$/;

/**
 * Reads the change id out of a PR body.
 * @returns the id, or null when the body has no `Countersign:` line
 * @example findChangeId("[agent:app]\n\nCountersign: mp-2283\n") // "mp-2283"
 */
export function findChangeId(body) {
  return CHANGE_LINE.exec(body)?.[1] ?? null;
}

function main() {
  const changeId = process.env.INPUT_CHANGE_ID?.trim() || findChangeId(process.env.PR_BODY ?? "");
  if (changeId === null || changeId === "") {
    console.log("No `Countersign: <changeId>` line in the PR body: nothing to gate or review.");
    writeOutput("");
    return;
  }
  if (!CHANGE_ID.test(changeId)) {
    console.error(
      `::error::"${changeId}" is not a change id: use letters, digits and dashes, like mp-2283.`,
    );
    process.exit(1);
  }
  if (!existsSync(`data/sample/changes/${changeId}.json`)) {
    console.error(
      `::error::Countersign names "${changeId}", which has no change input in data/sample/changes/. Fix the id in the PR body.`,
    );
    process.exit(1);
  }
  console.log(`Change: ${changeId}`);
  writeOutput(changeId);
}

function writeOutput(changeId) {
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `change_id=${changeId}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
