// Message check: the PR title, the PR body and every commit message in the PR contain no emoji
// and no AI co-author trailer. Squash merges copy the title and body into main's history, so a
// slip here is permanent. The rules are the ones the local guard enforces (guardShell.mjs), so a
// message that passes on a laptop passes here. docs/setup.md section 6, step 0.
//
// Env: PR_TITLE, PR_BODY (passed through `env:` so quoting can't be abused). Commits come from
// `git log BASE_SHA..HEAD` (origin/main when unset, for local runs), which is why the checkout needs full history.
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { EMOJI, TRAILER } from "../../.claude/hooks/lib/guardShell.mjs";

/**
 * Lists what is wrong with the texts a PR will leave in git history.
 * @param {{title: string, body: string, commits: string[]}} texts
 * @returns {string[]} one line per problem; empty when everything is clean
 * @example findMessageProblems({ title: "feat: x", body: "", commits: ["fix: y\n\nCo-Authored-By: Claude <a@b>"] })
 *   // -> ['commit "fix: y": has an AI co-author trailer or "Generated with" line; remove it']
 */
export function findMessageProblems({ title, body, commits }) {
  const labelled = [
    { label: "PR title", text: title },
    { label: "PR body", text: body },
    ...commits.map((text) => ({ label: `commit "${firstLine(text)}"`, text })),
  ];
  const problems = [];
  for (const { label, text } of labelled) {
    if (EMOJI.test(text)) problems.push(`${label}: has an emoji or :shortcode:; use plain text`);
    if (TRAILER.test(text))
      problems.push(`${label}: has an AI co-author trailer or "Generated with" line; remove it`);
  }
  return problems;
}

function firstLine(text) {
  return text.trim().split("\n")[0].slice(0, 60);
}

/** Commit messages of the PR, one string each. */
function readCommitMessages() {
  // %x00 separates messages, because a message body can contain blank lines.
  const log = execFileSync(
    "git",
    ["log", "--format=%B%x00", `${process.env.BASE_SHA || "origin/main"}..HEAD`],
    {
      encoding: "utf8",
    },
  );
  return log.split("\0").filter((message) => message.trim() !== "");
}

function main() {
  const problems = findMessageProblems({
    title: process.env.PR_TITLE ?? "",
    body: process.env.PR_BODY ?? "",
    commits: readCommitMessages(),
  });
  for (const problem of problems) console.error(`::error::${problem}`);
  if (problems.length > 0) process.exit(1);
  console.log("Messages are clean.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
