// Lane check: every change names its lane. A PR touches only its author's lanes; another
// lane's files or a shared path need the `cross-lane` label, which the affected owner adds
// after agreeing. Also fails when .claude/lanes.json and the Lanes table in CLAUDE.md drift apart.
// Reuses the hooks' path classifier, so CI and the local guard cannot disagree.
// docs/setup.md section 6, step 1; .claude/rules/lanes.md.
//
// Env: PR_AUTHOR (login), PR_LABELS (JSON array of label names), BASE_SHA (the PR's base commit;
// origin/main when unset, for local runs). Files come from `git diff BASE_SHA...HEAD`.
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  classifyPath,
  compareWithClaudeMd,
  lanesTouched,
  loadLanes,
} from "../../.claude/hooks/lib/lanes.mjs";

const CROSS_LANE_LABEL = "cross-lane";

/**
 * Finds the files a PR may not touch without the `cross-lane` label.
 * An owner with several lanes (miska-voutilainen: engine and app) owns all of them, and a
 * lane's `coOwners` count as owners (eliasnorta took over UI changes in the app lane).
 * @returns {{path: string, reason: string}[]}
 */
export function findLaneViolations({ files, author, labels, config }) {
  if (labels.includes(CROSS_LANE_LABEL)) return [];
  const login = author.toLowerCase();
  const ownLanes = new Set(
    Object.entries(config.lanes)
      .filter(([, lane]) =>
        [lane.owner, ...(lane.coOwners ?? [])].some((owner) => owner.toLowerCase() === login),
      )
      .map(([name]) => name),
  );
  const violations = [];
  for (const path of files) {
    const where = classifyPath(path, config);
    if (where.kind === "shared") violations.push({ path, reason: "shared path" });
    else if (where.kind === "lane" && !ownLanes.has(where.lane))
      violations.push({ path, reason: `path in the ${where.lane} lane (owner ${where.owner})` });
  }
  return violations;
}

/** The job-summary text: which lanes the PR touches. */
export function summarise({ files, config, author }) {
  const touched = lanesTouched(files, config);
  const lanes = touched.length > 0 ? touched.join(", ") : "none (docs and open paths only)";
  // Files no lane, shared or open glob matches: not a failure, but someone should assign them.
  const unmatched = files.filter((path) => classifyPath(path, config).kind === "unmatched");
  const unmatchedLine =
    unmatched.length > 0 ? `\nNot in any lane (add to lanes.json): ${unmatched.join(", ")}\n` : "";
  return `### Lane check\n\nAuthor: ${author}\n\nLanes touched: ${lanes}\n\nFiles changed: ${files.length}\n${unmatchedLine}`;
}

function changedFiles() {
  // Three dots: only what the PR adds on top of main, not what main gained meanwhile.
  const out = execFileSync(
    "git",
    ["diff", "--name-only", `${process.env.BASE_SHA || "origin/main"}...HEAD`],
    {
      encoding: "utf8",
    },
  );
  return out.split("\n").filter((line) => line !== "");
}

function main() {
  const config = loadLanes(process.cwd());
  if (!config) {
    console.error(
      "::error::Cannot read .claude/lanes.json. Check that it exists and is valid JSON.",
    );
    process.exit(1);
  }

  const tableProblems = compareWithClaudeMd(config, readFileSync("CLAUDE.md", "utf8"));
  const author = process.env.PR_AUTHOR ?? "";
  const labels = JSON.parse(process.env.PR_LABELS || "[]");
  const files = changedFiles();

  const summary = summarise({ files, config, author });
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  else console.log(summary);

  const violations = findLaneViolations({ files, author, labels, config });
  for (const { path, reason } of violations)
    console.error(
      `::error file=${path}::${path} is a ${reason}: ${author} may not change it without the "${CROSS_LANE_LABEL}" label. Ask the owner, then add the label.`,
    );
  for (const problem of tableProblems)
    console.error(
      `::error file=CLAUDE.md::${problem}. Change lanes.json and the Lanes table together.`,
    );
  if (violations.length > 0 || tableProblems.length > 0) process.exit(1);
  console.log("Lanes are in order.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
