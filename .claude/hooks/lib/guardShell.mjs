// Shell rows of the PreToolUse guard (docs/setup.md section 4.2): checking each command of a Bash
// or PowerShell line against the table. A seatbelt, not a shell parser; tokenising is in guardTokens.
import { resolve } from "node:path";
import { ghRows } from "./guardGh.mjs";
import { SUBSTITUTION_PLACEHOLDER, optValues, splitCommand, substitutions, words } from "./guardTokens.mjs";
import { isOutside, normalisePath } from "./lanes.mjs";

export const EMOJI = /\p{Extended_Pictographic}|\uFE0F|(?<![\w:]):[a-z0-9_+-]+:(?![\w:])/u;
export const TRAILER = /co-authored-by\s*[:=][^\n]*(claude|anthropic)|Generated with \[Claude Code\]\(/i;
const ENV_FILE = /(^|\/)\.env(?![\w-])/i;
const ENV_EXAMPLE = /(^|\/)\.env\.example$/i;
const HARNESS = /\.claude\/(hooks\/|settings\.json)/i;
const HARNESS_VERBS = new Set([
  "mv", "cp", "rm", "tee", "set-content", "out-file", "remove-item", "move-item",
  // PowerShell writers and their aliases: each can create, overwrite or delete a harness file.
  "add-content", "ac", "copy-item", "cpi", "copy", "new-item", "ni", "sc", "del", "ri", "erase", "move", "mi",
]);
const DELETE_CMDS = new Set(["rm", "remove-item", "ri", "del", "erase", "rd", "rmdir"]);
const CD_CMDS = new Set(["cd", "chdir", "pushd", "popd", "set-location", "sl"]);
const NPM_SUBS = { install: "install", i: "install", ci: "install --frozen-lockfile", add: "add", uninstall: "remove", remove: "remove", update: "update" };

const MAX_NESTING = 5;
// Wrappers that run the rest of their line as a command: the flags that take a value, and how
// many plain words precede the command (`timeout 5 git push`).
const WRAPPERS = {
  env: { values: ["-u", "-C", "-S"], lead: 0 },
  command: { values: [], lead: 0 },
  time: { values: [], lead: 0 },
  nohup: { values: [], lead: 0 },
  exec: { values: [], lead: 0 },
  nice: { values: ["-n"], lead: 0 },
  stdbuf: { values: ["-i", "-o", "-e"], lead: 0 },
  timeout: { values: ["-s", "-k"], lead: 1 },
  sudo: { values: ["-u", "-g", "-C", "-h", "-p"], lead: 0 },
  xargs: { values: ["-n", "-I", "-P", "-L", "-d", "-E", "-s"], lead: 0 },
};
// Shells that run a command string, and the flag that introduces it.
const COMMAND_STRING_FLAGS = {
  bash: /^-[a-zA-Z]*c[a-zA-Z]*$/, sh: /^-[a-zA-Z]*c[a-zA-Z]*$/, zsh: /^-[a-zA-Z]*c[a-zA-Z]*$/,
  dash: /^-[a-zA-Z]*c[a-zA-Z]*$/, ksh: /^-[a-zA-Z]*c[a-zA-Z]*$/,
  cmd: /^\/{1,2}[ck]$/i, pwsh: /^-c(ommand)?$/i, powershell: /^-c(ommand)?$/i,
};
const ENCODED_FLAG = /^-(e|ec|enc|encodedcommand)$/i;

/**
 * True when a path, glob or shell word names a `.env` file other than `.env.example`.
 * Strips redirect and substitution punctuation and tests each `,` `:` `=` `{` `}` piece too.
 */
export function envHit(word) {
  const stripped = String(word).replace(/^(?:\$\(|[<(`"'])+/, "").replace(/[)`"']+$/, "");
  return stripped.split(/[,:={}]/).some((s) => {
    const n = s.replaceAll("\\", "/");
    return ENV_FILE.test(n) && !ENV_EXAMPLE.test(n);
  });
}

const cmdName = (w) => w.replace(/\\/g, "/").split("/").pop().toLowerCase().replace(/\.(exe|cmd|bat|ps1)$/, "");

/** Drops a leading `&` call operator and `NAME=value` assignments. */
function cleanWords(ws) {
  let i = 0;
  while (i < ws.length && (ws[i] === "&" || /^[A-Za-z_][A-Za-z0-9_]*=/.test(ws[i]))) i++;
  return ws.slice(i);
}

/**
 * Splits `git [-C dir] [-c k=v] <sub> <rest>`. `dirs` lists every `-C` directory in order: git
 * applies each relative to the one before, so the command runs in all of them combined.
 */
function gitCmd(args) {
  let i = 0;
  const dirs = [];
  while (i < args.length && args[i].startsWith("-")) {
    if (args[i] === "-C" && args[i + 1] !== undefined) dirs.push(args[i + 1]);
    i += ["-C", "-c", "--git-dir", "--work-tree"].includes(args[i]) ? 2 : 1;
  }
  return { sub: args[i], rest: args.slice(i + 1), dirs };
}

const shortLetters = (ws) => ws.filter((w) => /^-[a-zA-Z]+$/.test(w)).join("").replace(/-/g, "");

function gitRows(sub, rest, ctx, add) {
  if (sub === "push") pushRows(rest, ctx, add);
  else if (sub === "rebase") {
    if (!rest.includes("--abort") && !rest.includes("--continue"))
      add("ask", "never rebase a pushed branch; merge origin/main instead");
  } else if (sub === "reset") {
    if (rest.includes("--hard")) add("ask", "discards uncommitted work");
  } else if (sub === "clean") {
    const letters = shortLetters(rest) + (rest.includes("--force") ? "f" : "");
    if (letters.includes("f") && letters.includes("d")) add("ask", "discards uncommitted work");
  } else if (sub === "checkout") {
    const i = rest.indexOf("--");
    if (i >= 0 && rest[i + 1] === ".") add("ask", "discards uncommitted work");
  }
}

/** Push rows: no force, no `--all`, never to main. A push with no named branch goes to the current one. */
function pushRows(rest, ctx, add) {
  const positional = rest.filter((w) => !w.startsWith("-"));
  const refspecs = positional.slice(1);
  const force = rest.some((w) => w === "--force" || w.startsWith("--force-with-lease") || w === "--mirror" || (/^-[a-zA-Z]+$/.test(w) && w.includes("f")));
  if (force || refspecs.some((r) => r.startsWith("+")))
    add("deny", "force push is not allowed: push normally or ask the owner", true);
  if (rest.includes("--all")) add("deny", "pushing all branches is not allowed: push the one branch", true);
  const toMain = refspecs.some((r) => ["main", "refs/heads/main"].includes(r.replace(/^\+/, "").split(":").pop()));
  if (toMain) return add("deny", "open a PR (ship-pr)", true);
  if (refspecs.some((r) => r.includes(SUBSTITUTION_PLACEHOLDER)))
    add("ask", "the branch to push is computed: check it is not main");

  const headRef = refspecs.some((r) => ["HEAD", "@"].includes(r.replace(/^\+/, "")));
  if (positional.length > 1 && !headRef) return;
  const branch = ctx.cwd === null ? null : ctx.io.currentBranch(ctx.cwd);
  // An unreadable branch (cwd is not a repo) must not read as "not main".
  if (branch == null) add("ask", "could not read the current branch; check it is not main before pushing");
  else if (branch === "main") add("deny", "open a PR (ship-pr)", true);
}

function deleteRows(cmd, args, rawArgs, ctx, add) {
  const recursive =
    cmd === "rm"
      ? args.some((w) => /^-[a-zA-Z]*[rR]/.test(w) || w === "--recursive")
      : args.some((w) => w.length >= 2 && w.startsWith("-") && "-recurse".startsWith(w.toLowerCase()));
  if (!recursive) return;
  const targets = [...args, ...rawArgs].filter((w) => !w.startsWith("-"));
  if (!targets.length) add("ask", "recursive delete with a piped target: check it by hand");
  else if (targets.some((w) => isOutside(normalisePath(w, ctx.root)) || /^[$%]/.test(w)))
    add("deny", "recursive delete outside the repo is not allowed", true);
}

function packageManagerRow(cmd, args, add) {
  const sub = args.find((w) => !w.startsWith("-"));
  let fix = null;
  if (cmd === "npm" && sub && Object.hasOwn(NPM_SUBS, sub)) fix = NPM_SUBS[sub];
  else if (cmd === "yarn") fix = sub && sub !== "install" ? (sub === "remove" ? "remove" : sub) : "install";
  else if (cmd === "bun" && (sub === "install" || sub === "add")) fix = sub;
  if (fix) add("deny", `this repo uses pnpm: use pnpm ${fix}`);
}

/** Runs every shell row for `command`, reporting findings through add(decision, reason, isSafetyRow). */
export function shellRows(command, ctx, input, add) {
  const { io, lane } = ctx;
  const emojiTexts = [];
  const trailerTexts = [];
  // A body file resolves where the command runs: the `cd` directory first (a sibling worktree has its
  // own .scratch/), then the hook's cwd, then the repo root. env.cwd moves with `cd`, hence the closure.
  const readBody = (p) => {
    for (const base of [env.cwd, input.cwd, ctx.root]) {
      if (!base) continue;
      const t = io.readFile(resolve(base, p));
      if (t != null) return t.replace(/^﻿/, "");
    }
    return null;
  };
  const esc = input.tool_name === "PowerShell" ? "`" : "\\";
  // cwd follows `cd` parts, so `cd <checkout> && git push` looks up the branch of that checkout.
  const env = { ctx, add, io, lane, esc, readBody, emojiTexts, trailerTexts, fullCommand: command, cwd: input.cwd ?? ctx.root };

  checkCommandLine(command, env, 0);

  if (emojiTexts.some((t) => EMOJI.test(t)))
    add("deny", "no emoji in commit messages or PRs (team rule); plain text only");
  if (trailerTexts.some((t) => TRAILER.test(t)))
    add("deny", "no AI trailers or boilerplate; declare AI use in the PR's AI use section (git.md)");
}

/**
 * Checks every command in a line, then the command lines hidden inside it: nested commands
 * (`$( ... )`, backticks, `( ... )` in an argument) and the string a wrapper runs (`bash -c "..."`).
 * `depth` stops runaway nesting.
 */
function checkCommandLine(line, env, depth) {
  if (depth > MAX_NESTING) {
    env.add("ask", "command nested too deeply to check: run it by hand");
    return;
  }
  const { parts, nested } = splitCommand(line, env.esc);
  for (const inner of [...substitutions(line, env.esc), ...nested]) checkNested(inner, env, depth);
  for (const part of parts) {
    for (const inner of checkPart(part, env)) checkNested(inner, env, depth);
  }
}

/** Checks a command line that runs inside another; a `cd` in it doesn't move the outer line. */
function checkNested(line, env, depth) {
  const outerDir = env.cwd;
  checkCommandLine(line, env, depth + 1);
  env.cwd = outerDir;
}

/**
 * Peels `env`, `sudo`, `xargs` and the like off a command's words, so the command they run is
 * the one checked. Returns the bare words, the command lines a shell wrapper runs
 * (`bash -c "..."`, `cmd /c ...`, `pwsh -Command "..."`, `iex "..."`) for the caller to check on
 * their own, and whether the shell was given an encoded command, which can't be read.
 */
function unwrap(ws) {
  const nested = [];
  let encoded = false;
  let cur = ws;
  for (let step = 0; step < MAX_NESTING && cur.length; step++) {
    const name = cmdName(cur[0]);
    const wrapper = Object.hasOwn(WRAPPERS, name) ? WRAPPERS[name] : null;
    if (wrapper) {
      let i = 1;
      while (i < cur.length && (cur[i].startsWith("-") || /^[A-Za-z_][A-Za-z0-9_]*=/.test(cur[i])))
        i += wrapper.values.includes(cur[i]) ? 2 : 1;
      cur = cur.slice(i + wrapper.lead);
      continue;
    }
    if (Object.hasOwn(COMMAND_STRING_FLAGS, name)) {
      const flag = cur.findIndex((w, i) => i > 0 && COMMAND_STRING_FLAGS[name].test(w));
      if (flag >= 0) nested.push(cur.slice(flag + 1).join(" "));
      encoded = cur.some((w, i) => i > 0 && ENCODED_FLAG.test(w));
    } else if (name === "iex" || name === "invoke-expression") nested.push(cur.slice(1).join(" "));
    break;
  }
  return { ws: cur, nested, encoded };
}

/** Applies every shell row to one command; returns the command lines it wraps, for the caller to check. */
function checkPart(part, env) {
  const { ctx, add, io, lane, esc, readBody, emojiTexts, trailerTexts, fullCommand } = env;
  const unwrapped = unwrap(cleanWords(words(part.text, esc)));
  const ws = unwrapped.ws;
  if (unwrapped.encoded) add("ask", "encoded shell command can't be checked: run it by hand");
  if (!ws.length) return unwrapped.nested;
  const raw = unwrap(cleanWords(words(part.text, null))).ws;
  const cmd = cmdName(ws[0]);
  const args = ws.slice(1);

  if ([...ws, ...raw].some(envHit)) add("deny", ".env holds secrets; use .env.example", true);
  harnessRow(part.source, cmd, args, add);

  if (cmd === "echo" && args[0] === "guard-check") add("deny", "guard is active (canary)", true);
  const gi = ws.findIndex((w) => cmdName(w) === "graphify");
  if (gi >= 0 && ws[gi + 1]?.toLowerCase() === "claude" && ws[gi + 2]?.toLowerCase() === "install")
    add("deny", "it rewrites CLAUDE.md and the shared hooks; the kit's rule is .claude/rules/tools.md");
  if (DELETE_CMDS.has(cmd)) deleteRows(cmd, args, raw.slice(1), ctx, add);
  if (["npm", "yarn", "bun"].includes(cmd)) packageManagerRow(cmd, args, add);

  if (CD_CMDS.has(cmd)) {
    if (!part.grouped) env.cwd = directoryAfterCd(cmd, args, env.cwd);
  } else if (cmd === "git") {
    const { sub, rest, dirs } = gitCmd(args);
    const cwd = env.cwd === null ? null : dirs.reduce(inDirectory, env.cwd);
    gitRows(sub, rest, { ...ctx, cwd }, add);
    if (sub === "commit") {
      emojiTexts.push(fullCommand);
      trailerTexts.push(fullCommand);
      for (const f of optValues(rest, ["--file"], ["-F"])) {
        const t = readBody(f);
        if (t != null) {
          emojiTexts.push(t);
          trailerTexts.push(t);
        }
      }
    }
  } else if (cmd === "gh") {
    ghRows(args, { lane, io, readBody, emojiTexts, trailerTexts, cwd: env.cwd ?? ctx.root }, add);
  }
  return unwrapped.nested;
}

/** `dir` relative to `base`; a Git Bash path (`/c/x`) becomes a Windows one (`C:/x`) first. */
function inDirectory(base, dir) {
  const native = process.platform === "win32" ? dir.replace(/^\/([a-zA-Z])(?=\/|$)/, "$1:") : dir;
  return resolve(base, native);
}

/**
 * The directory after a `cd`, or null when it can't be known (`pushd`, `popd`, `cd -`, `~`, a
 * computed target): a later push then asks instead of reading the wrong checkout's branch.
 */
function directoryAfterCd(cmd, args, current) {
  const target = args.find((w) => !w.startsWith("-"));
  if (cmd === "pushd" || cmd === "popd") return null;
  if (!target) return current;
  if (target === "-" || target.startsWith("~") || target.includes(SUBSTITUTION_PLACEHOLDER)) return null;
  return current === null ? null : inDirectory(current, target);
}

/** Asks when a command writes, copies over or deletes a harness file (hooks, settings.json). */
function harnessRow(part, cmd, args, add) {
  const norm = part.replace(/\\/g, "/");
  if (!HARNESS.test(norm)) return;
  const redirect = />>?\s*["']?[^\s"'|;&]*\.claude\/(hooks\/|settings\.json)/i.test(norm);
  const sedInPlace = cmd === "sed" && args.some((w) => /^-[a-zA-Z]*i/.test(w) || w === "--in-place");
  if (redirect || sedInPlace || HARNESS_VERBS.has(cmd))
    add("ask", "harness file: use Edit so the change is visible, and agree it with the team");
}

