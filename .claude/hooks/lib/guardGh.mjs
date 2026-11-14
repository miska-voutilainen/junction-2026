// `gh` rows of the PreToolUse guard (docs/setup.md section 4.2): only the author merges, no
// approvals, issue #1 stays untouched, and agent-written GitHub text carries its lane marker.
import { optValues } from "./guardTokens.mjs";

const REPO_FLAGS = new Set(["-R", "--repo"]);
const SYNC_LOG_REASON = "#1 is the agent sync log; it stays open and unchanged";

/**
 * Splits `gh <group> <action> <rest>` when flags come first: `gh pr -R owner/repo merge 12`
 * is `pr merge 12`. The repo flag and its value leave `rest` (so `gh pr merge -R o/r 12` finds
 * PR 12, not the repo) and come back as `repo`, because PR 12 of another repo is a different PR.
 */
function ghCommand(args) {
  const kept = [];
  let repo = null;
  for (let i = 0; i < args.length; i++) {
    const w = args[i];
    if (REPO_FLAGS.has(w)) repo = args[++i] ?? repo;
    else if (w === "--hostname") i++;
    else if (/^--repo=/.test(w)) repo = w.slice("--repo=".length);
    else if (!/^--hostname=/.test(w)) kept.push(w);
  }
  const [group, action] = kept.filter((w) => !w.startsWith("-"));
  const actionAt = kept.indexOf(action);
  return { group, action, repo, rest: actionAt < 0 ? [] : kept.slice(actionAt + 1) };
}

/** Applies the gh rows to the words after `gh`; `env` carries lane, io, cwd, readBody and the text lists. */
export function ghRows(args, env, add) {
  const { lane, io, readBody, emojiTexts, trailerTexts, cwd } = env;
  const { group, action, repo, rest } = ghCommand(args);
  const key = `${group} ${action}`;

  if (key === "pr merge") {
    const n = rest.find((w) => !w.startsWith("-")) ?? null;
    const author = io.prAuthor(n, cwd, repo);
    const me = io.ghUser(cwd);
    if (!author || !me) add("ask", "could not check the PR author (gh failed); only the author merges");
    else if (author.toLowerCase() !== me.toLowerCase()) add("deny", "only the author merges");
  }
  if (key === "pr review" && rest.some((w) => w === "--approve" || w === "-a")) add("deny", "approvals are human");

  if (group === "issue" && ["close", "edit", "reopen"].includes(action)) {
    const hit = rest.some((w, i) => {
      if (!/^#?0*1$|\/issues\/0*1$/.test(w)) return false;
      const prev = rest[i - 1];
      return prev === undefined || !prev.startsWith("-") || prev.includes("=");
    });
    if (hit) add("deny", SYNC_LOG_REASON);
  }
  if (key === "issue delete") add("deny", SYNC_LOG_REASON);

  const hasBody = ["issue create", "issue comment", "pr create", "pr comment"].includes(key);
  const bodyFiles = optValues(rest, ["--body-file"], ["-F"]);
  if (hasBody) {
    if (!bodyFiles.length) add("deny", "write the text to a file and pass --body-file");
    const expected = lane ? `[agent:${lane}]` : "[agent:";
    for (const f of bodyFiles) {
      const t = readBody(f);
      const first = t == null ? null : t.replace(/\r/g, "").split("\n")[0];
      if (first == null || !first.startsWith(expected))
        add("deny", `agent-written GitHub text starts with [agent:${lane ?? "<lane>"}]${first == null ? ` (body file ${f} not found)` : ""}`);
      if (t != null) trailerTexts.push(t);
    }
  }
  if (["pr create", "pr edit", "pr merge"].includes(key)) {
    emojiTexts.push(...optValues(rest, ["--title", "--subject", "--body"], ["-t", "-b"]));
    for (const f of bodyFiles) {
      const t = readBody(f);
      if (t != null) emojiTexts.push(t);
    }
  }
}
