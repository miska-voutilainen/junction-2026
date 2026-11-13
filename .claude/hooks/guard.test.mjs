// Tests for guard.mjs: one case per table row in docs/setup.md 4.2, plus the 4.6 lane cases.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { decide, safeDecide } from "./guard.mjs";
import { loadLanes } from "./lib/lanes.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const lanes = loadLanes(root);
assert.ok(lanes, ".claude/lanes.json must load");

const state = { files: new Map(), branch: "feat/x", user: "me", author: "me" };
const io = {
  readFile: (p) => state.files.get(p) ?? null,
  fileExists: (p) => state.files.has(p),
  currentBranch: () => state.branch,
  ghUser: () => state.user,
  prAuthor: () => state.author,
};
const put = (name, text) => state.files.set(resolve(root, name), text);
put("ok.md", "\uFEFF[agent:engine] hello\r\nbody");
put("bad.md", "hello");
put("trailer.md", "[agent:engine] x\n\nCo-Authored-By: Claude <noreply@anthropic.com>");
put("boiler.md", "[agent:engine] x\n\n\u{1F916} Generated with [Claude Code](https://claude.com/claude-code)");
put("human.md", "feat: x\n\nCo-Authored-By: Elias <elias@example.com>");
put("aiuse.md", "[agent:engine] x\n\n## AI use\nComponents written by the builder subagent (Sonnet 5.5)");
put("emoji.md", "feat: add login \u2728");
put("trailer-commit.md", "feat: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>");
put("README.md", "x");

const ctx = (over = {}) => ({ root, lane: "engine", guardMode: undefined, lanes, io, ...over });
const file = (tool, path, extra = {}) => ({ tool_name: tool, tool_input: { file_path: path, ...extra }, cwd: root });
const write = (path, content = "x", over) => decide(file("Write", path, { content }), ctx(over));
const edit = (path, over) => decide(file("Edit", path, { old_string: "a", new_string: "b" }), ctx(over));
const shell = (command, tool = "Bash", over) => decide({ tool_name: tool, tool_input: { command }, cwd: root }, ctx(over));
const kind = (r) => r?.decision ?? null;

test("Read, Edit, Write: .env is denied, .env.example is not", () => {
  for (const t of ["Read", "Edit", "Write"]) {
    assert.equal(kind(decide(file(t, ".env", { content: "x", new_string: "x" }), ctx())), "deny");
    assert.equal(kind(decide(file(t, "apps/.env.local", { content: "x", new_string: "x" }), ctx())), "deny");
  }
  assert.match(decide(file("Read", ".env"), ctx()).reason, /\.env holds secrets; use \.env\.example/);
  assert.equal(kind(decide(file("Read", ".env.example"), ctx())), null);
  assert.equal(kind(decide(file("Read", "C:\\x\\env.ts"), ctx())), null);
});

test("Edit, Write: secrets folder and private keys are denied", () => {
  assert.equal(kind(write("secrets/a.txt")), "deny");
  assert.equal(kind(write("keys/server.pem")), "deny");
  assert.equal(kind(write("keys/id_rsa.pub")), "deny");
});

test("Edit, Write: likely secrets in text are denied, lookalikes are not", () => {
  const bad = [
    "sk-ant-api03-abcdefghijklmnopqrstuv",
    "sk-abcdefghijklmnopqrstuvwxyz",
    "nvapi-abcdefghijklmnopqrstuvwx",
    `ghp_${"a".repeat(30)}`,
    `github_pat_${"a".repeat(30)}`,
    "AKIAABCDEFGHIJKLMNOP",
    "-----BEGIN RSA PRIVATE KEY-----",
  ];
  for (const s of bad) {
    const r = write("src/rules/a.ts", `const k = "${s}"`);
    assert.equal(kind(r), "deny", s);
    assert.match(r.reason, /put it in \.env and read it from the environment/);
  }
  assert.equal(kind(write("src/rules/a.ts", "task-list risk-badge sk-short")), null);
  assert.equal(kind(edit("src/rules/a.ts")), null);
  const multi = decide({ tool_name: "MultiEdit", tool_input: { file_path: "src/rules/a.ts", edits: [{ new_string: "ghp_" + "b".repeat(31) }] } }, ctx());
  assert.equal(kind(multi), "deny");
});

test("lanes: own, other, shared, open, unset, local", () => {
  assert.equal(kind(edit("src/rules/route.ts")), null);
  const other = edit("src/app/page.tsx");
  assert.equal(other.decision, "ask");
  assert.match(other.reason, /src\/app\/page\.tsx belongs to lane app \(owner miska-voutilainen\); talk to them or open a handoff/);
  assert.match(edit("src/contracts/review.ts").reason, /shared path: agree the change with the affected lanes/);
  assert.equal(kind(edit("docs/api.md")), null);
  assert.equal(kind(edit("src/rules/route.ts", { lane: undefined })), "ask");
  assert.match(edit("src/rules/route.ts", { lane: undefined }).reason, /set env\.LANE in \.claude\/settings\.local\.json/);
  assert.equal(kind(edit("docs/api.md", { lane: undefined })), null);
  assert.equal(kind(edit(".claude/settings.local.json", { lane: undefined })), null);
  assert.equal(kind(edit("src/app/page.tsx", { lanes: null })), null);
  assert.equal(kind(edit("C:\\Users\\x\\src\\app\\page.tsx", { root: "C:\\other" })), null);
});

test("harness files ask", () => {
  assert.match(edit(".claude/lanes.json").reason, /lane map: change it together with the Lanes table in CLAUDE\.md, with the team's agreement/);
  assert.match(edit(".claude/hooks/guard.mjs").reason, /harness file: it decides what every agent may do; agree the change with the team/);
  assert.equal(kind(edit(".claude/settings.json")), "ask");
  assert.equal(kind(edit(".claude/rules/lanes.md")), "ask");
  assert.equal(kind(edit(".claude/hooks/guard.mjs", { lanes: null })), "ask");
});

test("Write: new root files, existing root files and the allowlist", () => {
  const r = write("notes.txt");
  assert.equal(r.decision, "ask");
  assert.match(r.reason, /put it in a folder, or add it to the File tree in CLAUDE\.md first/);
  for (const f of ["README.md", "pnpm-workspace.yaml", "components.json", "vercel.json", "next.config.ts", "tsconfig.build.json", ".prettierrc.json", "uv.lock"])
    assert.equal(kind(write(f, "x", { lanes: null })), null, f);
  assert.equal(kind(write("src/rules/notes.txt")), null);
});

test("Write: file name segments", () => {
  for (const f of ["template.tsx", "CopyButton.tsx", "temperature.ts", "finalize.ts"]) assert.equal(kind(write(`src/rules/${f}`)), null, f);
  for (const f of ["page-copy.tsx", "old_api.ts", "temp.json", "Backup file.ts", "x.v2.ts", "untitled.md", "a-final.ts", "tmp"]) {
    const r = write(`src/rules/${f}`);
    assert.equal(r.decision, "deny", f);
    assert.match(r.reason, /name it for what it is \(structure\.md\)/);
  }
  assert.equal(kind(edit("src/rules/old_api.ts")), null);
});

test("Write: scratch files ask outside the allowed folders", () => {
  assert.match(write("src/rules/shot.png").reason, /scratch goes in \.scratch\/ \(gitignored\)/);
  assert.equal(kind(write("run.log", "x", { lanes: null })), "ask");
  for (const p of ["public/hero.png", "docs/a.png", ".scratch/a.log", ".review/shot.png"]) assert.equal(kind(write(p, "x", { lane: "app" })), null, p);
});

// Every shell row, run for both the Bash and the PowerShell tool: [command, decision, reason pattern].
const SHELL_ROWS = [
  ["cat .env", "deny", /\.env holds secrets; use \.env\.example/],
  ["Get-Content .env.local", "deny", /\.env holds secrets/],
  ["grep KEY .env", "deny", /\.env holds secrets/],
  ["cat .env.example", null],
  ["git push --force origin feat/x", "deny", /force/],
  ["git push -f", "deny", /force/],
  ["git push --force-with-lease origin x", "deny", /force/],
  ["git push origin +feat/x", "deny", /force/],
  ["git push origin feat/x", null],
  ["git push origin main", "deny", /open a PR \(ship-pr\)/],
  ["git push origin HEAD:main", "deny", /open a PR/],
  ["git push origin HEAD:refs/heads/main", "deny", /open a PR/],
  ["git rebase main", "ask", /never rebase a pushed branch; merge origin\/main instead/],
  ["git rebase --abort", null],
  ["git rebase --continue", null],
  ["rm -rf /tmp/x", "deny", /outside the repo/],
  ["rm -fr ../x", "deny", /outside/],
  ["rm -rf ~/x", "deny", /outside/],
  ["Remove-Item -Recurse -Force C:\\Users\\x", "deny", /outside/],
  ["rm -rf dist", null],
  ["git reset --hard", "ask", /discards uncommitted work/],
  ["git clean -fd", "ask", /discards uncommitted work/],
  ["git checkout -- .", "ask", /discards uncommitted work/],
  ["git status", null],
  ["npm install left-pad", "deny", /this repo uses pnpm: use pnpm install/],
  ["npm ci", "deny", /use pnpm install/],
  ["yarn add x", "deny", /use pnpm add/],
  ["bun add x", "deny", /use pnpm add/],
  ["npx tsc --noEmit", null],
  ["pnpm dlx shadcn add button", null],
  ["pnpm install", null],
  ["gh pr review 4 --approve", "deny", /approvals are human/],
  ["gh pr review 4 -a", "deny", /approvals are human/],
  ["gh pr review 4 --comment", null],
  ["gh issue create --title x", "deny", /write the text to a file and pass --body-file/],
  ["gh pr comment 3 --body hi", "deny", /--body-file/],
  ["gh issue comment 12 --body-file ok.md", null],
  ["gh pr create --title feat --body-file=ok.md", null],
  ["gh issue create -F ok.md", null],
  ["gh issue comment 12 --body-file missing.md", "deny", /agent-written GitHub text starts with \[agent:engine\]/],
  ["gh issue comment 12 --body-file bad.md", "deny", /agent-written GitHub text starts with \[agent:engine\]/],
  ["gh issue edit 1 --title x", "deny", /#1 is the agent sync log; it stays open and unchanged/],
  ['gh issue close "#1"', "deny", /agent sync log/],
  ["gh issue reopen 1", "deny", /agent sync log/],
  ["gh issue delete 7", "deny", /agent sync log/],
  ["gh issue edit 12 --add-assignee @me", null],
  ["gh issue edit 12 --add-label 1", null],
  ["gh issue close 10", null],
  ["sed -i s/a/b/ .claude/settings.json", "ask", /harness file: use Edit so the change is visible, and agree it with the team/],
  ["echo x > .claude/hooks/guard.mjs", "ask", /harness file/],
  ["echo x | tee .claude/hooks/a.mjs", "ask", /harness file/],
  ["Set-Content .claude\\hooks\\guard.mjs x", "ask", /harness file/],
  ["cat .claude/settings.local.json", null],
  ["echo x > .claude/settings.local.json", null],
  ['git commit -m "feat: add login \u2728"', "deny", /no emoji in commit messages or PRs \(team rule\); plain text only/],
  ['git commit -m "feat: add login"', null],
  ['git commit -m ":sparkles: fix"', "deny", /no emoji/],
  ["git commit -F emoji.md", "deny", /no emoji/],
  ['gh pr create --title "\u{1F680} ship" --body-file ok.md', "deny", /no emoji/],
  ['gh pr merge 5 --subject ":tada: done"', "deny", /no emoji/],
  ['git commit -m "x" -m "Co-Authored-By: Claude <noreply@anthropic.com>"', "deny", /no AI trailers or boilerplate; declare AI use in the PR's AI use section \(git\.md\)/],
  ["git commit -F trailer-commit.md", "deny", /no AI trailers/],
  ["gh pr create --title t --body-file trailer.md", "deny", /no AI trailers/],
  ["gh issue comment 12 --body-file boiler.md", "deny", /no AI trailers/],
  ['git commit -m "x" -m "Co-Authored-By: Elias <elias@example.com>"', null],
  ["git commit -F human.md", null],
  ["gh pr create --title t --body-file aiuse.md", null],
  ["graphify claude install", "deny", /rewrites CLAUDE\.md and the shared hooks/],
  ["python -m graphify claude install", "deny", /rewrites CLAUDE\.md/],
  ["py -m graphify claude install", "deny", /rewrites CLAUDE\.md/],
  ["graphify query x", null],
  ["echo guard-check", "deny", /guard is active/],
  ["echo hello", null],
  ["ls && git push origin main", "deny", /open a PR/],
  ['echo "a && b; c" | cat', null],
];

for (const tool of ["Bash", "PowerShell"]) {
  test(`${tool}: every shell row`, () => {
    for (const [command, expected, pattern] of SHELL_ROWS) {
      const r = shell(command, tool);
      assert.equal(kind(r), expected, `${command} -> ${JSON.stringify(r)}`);
      if (pattern) assert.match(r.reason, pattern, command);
    }
  });
}

test("git push: bare push on main is denied, on a feature branch allowed", () => {
  state.branch = "main";
  assert.match(shell("git push").reason, /open a PR/);
  assert.equal(kind(shell("git push origin feat/x")), null);
  state.branch = "feat/x";
  assert.equal(kind(shell("git push")), null);
  state.branch = null;
  assert.equal(kind(shell("git push")), null);
  state.branch = "feat/x";
});

test("gh pr merge: author check", () => {
  state.author = "someone";
  assert.match(shell("gh pr merge 5 --squash").reason, /only the author merges/);
  state.author = "ME";
  assert.equal(kind(shell("gh pr merge 5 --squash")), null);
  state.author = null;
  assert.equal(kind(shell("gh pr merge 5")), "ask");
  state.author = "me";
});

test("[agent:<LANE>] check with LANE unset needs any [agent: prefix", () => {
  put("other.md", "[agent:app] hi");
  assert.equal(kind(shell("gh issue create --body-file other.md", "Bash", { lane: undefined })), null);
  assert.equal(kind(shell("gh issue create --body-file other.md")), "deny");
  assert.equal(kind(shell("gh issue create --body-file bad.md", "Bash", { lane: undefined })), "deny");
});

test("deny wins over ask; several asks are joined", () => {
  const r = shell("git rebase x && echo guard-check");
  assert.equal(r.decision, "deny");
  assert.doesNotMatch(r.reason, /rebase/);
  const asks = shell("git rebase x; git reset --hard");
  assert.equal(asks.decision, "ask");
  assert.match(asks.reason, /never rebase a pushed branch; merge origin\/main instead; discards uncommitted work/);
  const files = edit(".claude/hooks/guard.mjs");
  assert.match(files.reason, /shared path.*; .*harness file/);
});

test("GUARD=lite keeps only the safety rows", () => {
  const lite = { guardMode: "lite" };
  assert.equal(shell("echo guard-check", "Bash", lite).decision, "deny");
  assert.equal(shell("cat .env", "Bash", lite).decision, "deny");
  assert.equal(shell("git push --force", "Bash", lite).decision, "deny");
  assert.equal(shell("git push origin main", "Bash", lite).decision, "deny");
  assert.equal(shell("rm -rf /x", "PowerShell", lite).decision, "deny");
  assert.equal(write("keys/a.pem", "x", lite).decision, "deny");
  assert.equal(write("src/rules/a.ts", "ghp_" + "c".repeat(31), lite).decision, "deny");
  assert.equal(decide(file("Read", ".env"), ctx(lite)).decision, "deny");
  assert.equal(kind(edit("src/app/page.tsx", lite)), null);
  assert.equal(kind(edit(".claude/hooks/guard.mjs", lite)), null);
  assert.equal(kind(write("src/rules/page-copy.tsx", "x", lite)), null);
  assert.equal(kind(shell("npm install", "Bash", lite)), null);
  assert.equal(kind(shell("git rebase main", "Bash", lite)), null);
  assert.equal(kind(shell('git commit -m "x \u2728"', "Bash", lite)), null);
  assert.equal(kind(shell("gh issue edit 1", "Bash", lite)), null);
});

test("safeDecide turns an exception into ask", () => {
  const boom = { ...io, currentBranch: () => { throw new Error("boom"); } };
  const r = safeDecide({ tool_name: "Bash", tool_input: { command: "git push" }, cwd: root }, ctx({ io: boom }));
  assert.equal(r.decision, "ask");
  assert.match(r.reason, /guard error: boom/);
  assert.throws(() => decide({ tool_name: "Bash", tool_input: { command: "git push" }, cwd: root }, ctx({ io: boom })));
});

test("other tools and malformed input are allowed", () => {
  assert.equal(decide({ tool_name: "Grep", tool_input: {} }, ctx()), null);
  assert.equal(decide({}, ctx()), null);
  assert.equal(decide({ tool_name: "Bash", tool_input: {} }, ctx()), null);
});

const guardPath = resolve(root, ".claude/hooks/guard.mjs");
function runCli(input) {
  const started = Date.now();
  const r = spawnSync(process.execPath, [guardPath], {
    input: JSON.stringify(input),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: root, LANE: "engine", GUARD: "" },
  });
  return { ...r, ms: Date.now() - started };
}

test("end to end: Windows absolute path is denied by the name rule", () => {
  const winRoot = root.replace(/\//g, "\\").replace(/^[a-z]:/, (m) => m.toUpperCase());
  const r = runCli({ tool_name: "Write", tool_input: { file_path: `${winRoot}\\src\\app\\page-copy.tsx`, content: "x" }, cwd: winRoot });
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /name it for what it is/);
  console.log(`end-to-end call: ${r.ms} ms`);
});

test("end to end: the canary, and silence on an allowed call", () => {
  const r = runCli({ tool_name: "Bash", tool_input: { command: "echo guard-check" }, cwd: root });
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /guard is active/);
  const quiet = runCli({ tool_name: "Read", tool_input: { file_path: "README.md" }, cwd: root });
  assert.equal(quiet.status, 0);
  assert.equal(quiet.stdout, "");
});

// Review fixes: escapes, .env variants, push edge cases, false positives.
const denies = (cmd, tool = "Bash", over) => assert.equal(kind(shell(cmd, tool, over)), "deny", cmd);
const allows = (cmd, tool = "Bash", over) => assert.equal(kind(shell(cmd, tool, over)), null, cmd);

test("escape characters cannot hide a command", () => {
  for (const c of ['echo \\"; cat .env', 'echo \\"; git push --force origin feat', "cat .e\\nv", "git push origin ma\\in", "git push -\\f origin x"])
    denies(c);
  denies("echo `\"; Get-Content .env", "PowerShell");
  denies("git push origin ma`in", "PowerShell");
  allows("echo 'a\\' ; echo ok");
  allows('git commit -m "C:\\Users\\x"');
});

test(".env variants are denied, .env.example forms are not", () => {
  assert.equal(kind(decide(file("Read", "C:\\Users\\x\\repo\\.ENV"), ctx({ root: "C:\\Users\\x\\repo" }))), "deny");
  for (const c of ["cat .ENV", "cat .env*", "cat <.env", "echo $(cat .env)", "(Get-Content .env)", "Get-Content .env,README.md", "Get-Content -Path:.env"])
    for (const t of ["Bash", "PowerShell"]) denies(c, t);
  for (const c of ["cat .env.example", "cat <.env.example", "echo $(cat .env.example)", "Get-Content .env.example,README.md", "Get-Content -Path:.env.example", "cat .envrc"])
    allows(c);
  assert.equal(decide({ tool_name: "Grep", tool_input: { pattern: "K", path: ".env" } }, ctx()).decision, "deny");
  assert.equal(decide({ tool_name: "Grep", tool_input: { pattern: "K", glob: "**/.env*" } }, ctx()).decision, "deny");
  assert.equal(decide({ tool_name: "Grep", tool_input: { pattern: "K", path: "src", glob: "*.ts" } }, ctx()), null);
  assert.equal(decide({ tool_name: "Grep", tool_input: { pattern: "K", path: ".env.example" } }, ctx()), null);
});

test("push: --mirror, --all and HEAD resolve against the current branch", () => {
  denies("git push --mirror");
  denies("git push --all origin");
  state.branch = "main";
  denies("git push -u origin HEAD");
  denies("git push origin @");
  state.branch = "feat/x";
  allows("git push -u origin HEAD");
  allows("git push origin HEAD:refs/heads/feat/x");
});

test("recursive delete: flag rules and piped targets", () => {
  allows("Remove-Item -ErrorAction SilentlyContinue $env:TEMP\\x.txt", "PowerShell");
  allows("Remove-Item -Force x", "PowerShell");
  denies("Remove-Item -rec C:\\x", "PowerShell");
  denies("ri -r ..\\x", "PowerShell");
  assert.match(shell("Get-ChildItem | Remove-Item -Recurse", "PowerShell").reason, /recursive delete with a piped target: check it by hand/);
  assert.equal(kind(shell("find . | rm -rf")), "ask");
  denies("rm -rf C:\\x");
});

test("false positives: shortcode lookalikes, trailer forms, issue 01", () => {
  for (const m of ["fix: null check at src/app/page.tsx:42:7", "chore: add test:e2e:ui script", "at 10:30:00"]) allows(`git commit -m "${m}"`);
  denies('git commit -m ":sparkles: fix"');
  denies('git commit --trailer "Co-authored-by=Claude <noreply@anthropic.com>" -m x');
  denies("gh issue close 01");
  denies("gh issue close 001");
  allows("gh issue close 10");
});

test("normalisePath collapses dot segments before classification", () => {
  assert.equal(edit("src/../.claude/hooks/guard.mjs").decision, "ask");
  assert.match(edit("src/../.claude/hooks/guard.mjs").reason, /harness file/);
  assert.equal(kind(edit("src/../..", {})), null);
});
