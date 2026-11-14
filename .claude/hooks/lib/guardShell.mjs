// Shell rows of the PreToolUse guard (docs/setup.md section 4.2): tokenising a Bash or
// PowerShell command and checking each part against the table. A seatbelt, not a shell parser.
import { resolve } from "node:path";
import { isOutside, normalisePath } from "./lanes.mjs";

const EMOJI = /\p{Extended_Pictographic}|\uFE0F|(?<![\w:]):[a-z0-9_+-]+:(?![\w:])/u;
const TRAILER = /co-authored-by\s*[:=][^\n]*(claude|anthropic)|Generated with \[Claude Code\]\(/i;
const ENV_FILE = /(^|\/)\.env(?![\w-])/i;
const ENV_EXAMPLE = /(^|\/)\.env\.example$/i;
const HARNESS = /\.claude\/(hooks\/|settings\.json)/i;
const HARNESS_VERBS = new Set([
  "mv", "cp", "rm", "tee", "set-content", "out-file", "remove-item", "move-item",
  // PowerShell writers and their aliases: each can create, overwrite or delete a harness file.
  "add-content", "ac", "copy-item", "cpi", "copy", "new-item", "ni", "sc", "del", "ri", "erase", "move", "mi",
]);
const MAX_NESTING = 5;
// Wrappers that run the rest of their line as a command, with the flags that take a value.
const WRAPPERS = {
  env: ["-u", "-C", "-S"], command: [], time: [], nohup: [], exec: [], sudo: ["-u", "-g", "-C", "-h", "-p"],
  xargs: ["-n", "-I", "-P", "-L", "-d", "-E", "-s"],
};
const SHELL_C = new Set(["bash", "sh", "zsh", "dash", "ksh"]);
const POWERSHELL = new Set(["pwsh", "powershell"]);
const GH_VALUE_FLAGS = new Set(["-R", "--repo", "--hostname"]);
const DELETE_CMDS = new Set(["rm", "remove-item", "ri", "del", "erase", "rd", "rmdir"]);
const NPM_SUBS = { install: "install", i: "install", ci: "install --frozen-lockfile", add: "add", uninstall: "remove", remove: "remove", update: "update" };

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

/**
 * Splits a command on `&&`, `||`, `&`, `;`, `|`, newlines and parentheses outside quotes
 * (PowerShell also on `{` and `}`), so `a & b`, `(a)` and `{ a }` are checked as separate commands.
 * A `&` that belongs to a redirect (`2>&1`, `&>`, `>&`) stays in the part.
 * `esc` is the tool's escape character (backslash for Bash, backtick for PowerShell);
 * outside single quotes it makes the next character literal, so it can't open or close a quote.
 */
export function splitParts(cmd, esc = "\\") {
  const parts = [];
  let cur = "";
  let q = null;
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (esc && c === esc && q !== "'") {
      cur += c + (cmd[i + 1] ?? "");
      i++;
    } else if (q) {
      cur += c;
      if (c === q) q = null;
    } else if (c === '"' || c === "'") {
      q = c;
      cur += c;
    } else if ((c === "&" || c === "|") && cmd[i + 1] === c) {
      parts.push(cur);
      cur = "";
      i++;
    } else if (c === "&" && (cmd[i - 1] === ">" || cmd[i - 1] === "<" || cmd[i + 1] === ">")) {
      cur += c;
    } else if (isSeparator(c, esc)) {
      parts.push(cur);
      cur = "";
    } else cur += c;
  }
  parts.push(cur);
  return parts.map((s) => s.trim()).filter(Boolean);
}

/** True for a character that ends a command outside quotes; braces only separate in PowerShell. */
function isSeparator(c, esc) {
  return ";|&\n()".includes(c) || (esc === "`" && (c === "{" || c === "}"));
}

/** Splits one part into words, honouring quotes and the escape character `esc` (null: no escapes). */
export function words(part, esc = "\\") {
  const out = [];
  let cur = "";
  let has = false;
  let q = null;
  for (let i = 0; i < part.length; i++) {
    const c = part[i];
    if (esc && c === esc && q !== "'") {
      const n = part[i + 1];
      if (n === undefined || (q === '"' && esc === "\\" && !'"\$`'.includes(n))) cur += c;
      else {
        cur += n;
        has = true;
        i++;
      }
    } else if (q) {
      if (c === q) q = null;
      else cur += c;
    } else if (c === '"' || c === "'") {
      q = c;
      has = true;
    } else if (/\s/.test(c)) {
      if (has || cur) out.push(cur);
      cur = "";
      has = false;
    } else cur += c;
  }
  if (has || cur) out.push(cur);
  return out;
}

const cmdName = (w) => w.replace(/\\/g, "/").split("/").pop().toLowerCase().replace(/\.(exe|cmd|bat|ps1)$/, "");

/** Drops a leading `&` call operator and `NAME=value` assignments. */
function cleanWords(ws) {
  let i = 0;
  while (i < ws.length && (ws[i] === "&" || /^[A-Za-z_][A-Za-z0-9_]*=/.test(ws[i]))) i++;
  return ws.slice(i);
}

/** Values of an option in the forms `--long v`, `--long=v` and `-s v`. */
export function optValues(ws, long, short = []) {
  const vals = [];
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    if (long.includes(w) || short.includes(w)) {
      if (i + 1 < ws.length) vals.push(ws[++i]);
    } else if (w.startsWith("--") && w.includes("=") && long.includes(w.slice(0, w.indexOf("=")))) {
      vals.push(w.slice(w.indexOf("=") + 1));
    }
  }
  return vals;
}

/** Splits `git [-C dir] [-c k=v] <sub> <rest>`; `dir` is the last `-C` directory, where git runs. */
function gitCmd(args) {
  let i = 0;
  let dir = null;
  while (i < args.length && args[i].startsWith("-")) {
    if (args[i] === "-C") dir = args[i + 1] ?? dir;
    i += ["-C", "-c", "--git-dir", "--work-tree"].includes(args[i]) ? 2 : 1;
  }
  return { sub: args[i], rest: args.slice(i + 1), dir };
}

const shortLetters = (ws) => ws.filter((w) => /^-[a-zA-Z]+$/.test(w)).join("").replace(/-/g, "");

function gitRows(sub, rest, ctx, add) {
  if (sub === "push") {
    const positional = rest.filter((w) => !w.startsWith("-"));
    const refspecs = positional.slice(1);
    const force = rest.some((w) => w === "--force" || w.startsWith("--force-with-lease") || w === "--mirror" || (/^-[a-zA-Z]+$/.test(w) && w.includes("f")));
    if (force || refspecs.some((r) => r.startsWith("+")))
      add("deny", "force push is not allowed: push normally or ask the owner", true);
    if (rest.includes("--all")) add("deny", "pushing all branches is not allowed: push the one branch", true);
    const toMain = refspecs.some((r) => ["main", "refs/heads/main"].includes(r.replace(/^\+/, "").split(":").pop()));
    const headRef = refspecs.some((r) => ["HEAD", "@"].includes(r.replace(/^\+/, "")));
    if (toMain || ((positional.length <= 1 || headRef) && ctx.io.currentBranch(ctx.cwd) === "main"))
      add("deny", "open a PR (ship-pr)", true);
  } else if (sub === "rebase") {
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
  const readBody = (p) => {
    for (const base of [input.cwd, ctx.root]) {
      if (!base) continue;
      const t = io.readFile(resolve(base, p));
      if (t != null) return t.replace(/^﻿/, "");
    }
    return null;
  };
  const esc = input.tool_name === "PowerShell" ? "`" : "\\";
  const env = { ctx, input, add, io, lane, esc, readBody, emojiTexts, trailerTexts, fullCommand: command };

  checkCommandLine(command, env, 0);

  if (emojiTexts.some((t) => EMOJI.test(t)))
    add("deny", "no emoji in commit messages or PRs (team rule); plain text only");
  if (trailerTexts.some((t) => TRAILER.test(t)))
    add("deny", "no AI trailers or boilerplate; declare AI use in the PR's AI use section (git.md)");
}

/**
 * Checks every command in a line, then the command lines hidden inside it: `$( ... )` and
 * backticks (Bash), and the string a wrapper runs (`bash -c "..."`). `depth` stops runaway nesting.
 */
function checkCommandLine(line, env, depth) {
  if (depth > MAX_NESTING) {
    env.add("ask", "command nested too deeply to check: run it by hand");
    return;
  }
  for (const inner of substitutions(line, env.esc)) checkCommandLine(inner, env, depth + 1);
  for (const part of splitParts(line, env.esc)) {
    for (const inner of checkPart(part, env)) checkCommandLine(inner, env, depth + 1);
  }
}

/** The text inside each `$( ... )` and, in Bash, each pair of backticks, even inside double quotes. */
function substitutions(line, esc) {
  const found = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "$" && line[i + 1] === "(") {
      let depth = 1;
      let j = i + 2;
      for (; j < line.length && depth; j++) depth += line[j] === "(" ? 1 : line[j] === ")" ? -1 : 0;
      found.push(line.slice(i + 2, depth ? j : j - 1));
    } else if (line[i] === "`" && esc !== "`") {
      const end = line.indexOf("`", i + 1);
      if (end < 0) break;
      found.push(line.slice(i + 1, end));
      i = end;
    }
  }
  return found;
}

/**
 * Peels `env`, `sudo`, `xargs` and the like off a command's words, so the command they run is
 * the one checked. Returns the bare words, plus the command lines a shell wrapper runs
 * (`bash -c "..."`, `pwsh -Command "..."`, `iex "..."`) for the caller to check on their own.
 */
function unwrap(ws) {
  const nested = [];
  let cur = ws;
  for (let step = 0; step < MAX_NESTING && cur.length; step++) {
    const name = cmdName(cur[0]);
    if (Object.hasOwn(WRAPPERS, name)) {
      let i = 1;
      while (i < cur.length && (cur[i].startsWith("-") || /^[A-Za-z_][A-Za-z0-9_]*=/.test(cur[i])))
        i += WRAPPERS[name].includes(cur[i]) ? 2 : 1;
      cur = cur.slice(i);
      continue;
    }
    if (SHELL_C.has(name) || POWERSHELL.has(name)) {
      const isFlag = SHELL_C.has(name) ? (w) => /^-[a-zA-Z]*c$/.test(w) : (w) => /^-c(ommand)?$/i.test(w);
      const flag = cur.findIndex((w, i) => i > 0 && isFlag(w));
      if (flag >= 0) nested.push(cur.slice(flag + 1).join(" "));
    } else if (name === "iex" || name === "invoke-expression") nested.push(cur.slice(1).join(" "));
    break;
  }
  return { ws: cur, nested };
}

/** Applies every shell row to one command; returns the command lines it wraps, for the caller to check. */
function checkPart(part, env) {
  const { ctx, input, add, io, lane, esc, readBody, emojiTexts, trailerTexts, fullCommand } = env;
  const unwrapped = unwrap(cleanWords(words(part, esc)));
  const ws = unwrapped.ws;
  if (!ws.length) return unwrapped.nested;
  const raw = cleanWords(words(part, null));
  const cmd = cmdName(ws[0]);
  const args = ws.slice(1);

  if ([...ws, ...raw].some(envHit)) add("deny", ".env holds secrets; use .env.example", true);

  const norm = part.replace(/\\/g, "/");
  if (HARNESS.test(norm)) {
    const redirect = />>?\s*["']?[^\s"'|;&]*\.claude\/(hooks\/|settings\.json)/i.test(norm);
    const sedInPlace = cmd === "sed" && args.some((w) => /^-[a-zA-Z]*i/.test(w) || w === "--in-place");
    if (redirect || sedInPlace || HARNESS_VERBS.has(cmd))
      add("ask", "harness file: use Edit so the change is visible, and agree it with the team");
  }

  if (cmd === "echo" && args[0] === "guard-check") add("deny", "guard is active (canary)", true);
  const gi = ws.findIndex((w) => cmdName(w) === "graphify");
  if (gi >= 0 && ws[gi + 1]?.toLowerCase() === "claude" && ws[gi + 2]?.toLowerCase() === "install")
    add("deny", "it rewrites CLAUDE.md and the shared hooks; the kit's rule is .claude/rules/tools.md");
  if (DELETE_CMDS.has(cmd)) deleteRows(cmd, args, raw.slice(1), ctx, add);
  if (["npm", "yarn", "bun"].includes(cmd)) packageManagerRow(cmd, args, add);

  if (cmd === "git") {
    const { sub, rest, dir } = gitCmd(args);
    // Branch lookups run where git runs: the session's cwd, moved by `git -C <dir>`.
    const sessionDir = input.cwd ?? ctx.root;
    gitRows(sub, rest, { ...ctx, cwd: dir ? resolve(sessionDir, dir) : sessionDir }, add);
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
    ghRows(args, { lane, io, readBody, emojiTexts, trailerTexts, cwd: input.cwd ?? ctx.root }, add);
  }
  return unwrapped.nested;
}

/**
 * Splits `gh <group> <action> <rest>` when flags come first: `gh pr -R owner/repo merge 12`
 * is `pr merge 12`. The repo flags and their values are dropped, so `rest` holds only the
 * action's own arguments (`gh pr merge -R o/r 12` finds PR 12, not the repo).
 */
function ghCommand(args) {
  const kept = [];
  for (let i = 0; i < args.length; i++) {
    if (GH_VALUE_FLAGS.has(args[i])) i++;
    else if (!/^--(repo|hostname)=/.test(args[i])) kept.push(args[i]);
  }
  const [group, action] = kept.filter((w) => !w.startsWith("-"));
  const actionAt = kept.indexOf(action);
  return { group, action, rest: actionAt < 0 ? [] : kept.slice(actionAt + 1) };
}

function ghRows(args, env, add) {
  const { lane, io, readBody, emojiTexts, trailerTexts, cwd } = env;
  const { group, action, rest } = ghCommand(args);
  const key = `${group} ${action}`;

  if (key === "pr merge") {
    const n = rest.find((w) => !w.startsWith("-")) ?? null;
    const author = io.prAuthor(n, cwd);
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
    if (hit) add("deny", "#1 is the agent sync log; it stays open and unchanged");
  }
  if (key === "issue delete") add("deny", "#1 is the agent sync log; it stays open and unchanged");

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
      if (t != null && ["pr create", "pr comment", "issue create", "issue comment"].includes(key)) trailerTexts.push(t);
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
