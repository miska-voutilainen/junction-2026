// Shell rows of the PreToolUse guard (docs/setup.md section 4.2): tokenising a Bash or
// PowerShell command and checking each part against the table. A seatbelt, not a shell parser.
import { resolve } from "node:path";
import { isOutside, normalisePath } from "./lanes.mjs";

const EMOJI = /\p{Extended_Pictographic}|️|:[a-z0-9_+-]+:/u;
const TRAILER = /co-authored-by:[^\n]*(claude|anthropic)|Generated with \[Claude Code\]\(/i;
const ENV_FILE = /(^|\/)\.env(\.|$)/;
const ENV_EXAMPLE = /(^|\/)\.env\.example$/;
const HARNESS = /\.claude\/(hooks\/|settings\.json)/i;
const HARNESS_VERBS = new Set(["mv", "cp", "rm", "tee", "set-content", "out-file", "remove-item", "move-item"]);
const DELETE_CMDS = new Set(["rm", "remove-item", "ri", "del", "erase", "rd", "rmdir"]);
const NPM_SUBS = { install: "install", i: "install", ci: "install --frozen-lockfile", add: "add", uninstall: "remove", remove: "remove", update: "update" };

/** Splits a command on `&&`, `||`, `;`, `|` and newlines outside quotes. */
export function splitParts(cmd) {
  const parts = [];
  let cur = "";
  let q = null;
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (q) {
      cur += c;
      if (c === q) q = null;
    } else if (c === '"' || c === "'") {
      q = c;
      cur += c;
    } else if ((c === "&" || c === "|") && cmd[i + 1] === c) {
      parts.push(cur);
      cur = "";
      i++;
    } else if (c === ";" || c === "|" || c === "\n") {
      parts.push(cur);
      cur = "";
    } else cur += c;
  }
  parts.push(cur);
  return parts.map((s) => s.trim()).filter(Boolean);
}

/** Splits one part into words, honouring quotes (quotes are removed). */
export function words(part) {
  const out = [];
  let cur = "";
  let has = false;
  let q = null;
  for (const c of part) {
    if (q) {
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

function gitCmd(args) {
  let i = 0;
  while (i < args.length && args[i].startsWith("-")) i += ["-C", "-c", "--git-dir", "--work-tree"].includes(args[i]) ? 2 : 1;
  return { sub: args[i], rest: args.slice(i + 1) };
}

const shortLetters = (ws) => ws.filter((w) => /^-[a-zA-Z]+$/.test(w)).join("").replace(/-/g, "");

function gitRows(sub, rest, ctx, add) {
  if (sub === "push") {
    const positional = rest.filter((w) => !w.startsWith("-"));
    const refspecs = positional.slice(1);
    const force = rest.some((w) => w === "--force" || w.startsWith("--force-with-lease") || (/^-[a-zA-Z]+$/.test(w) && w.includes("f")));
    if (force || refspecs.some((r) => r.startsWith("+")))
      add("deny", "force push is not allowed: push normally or ask the owner", true);
    const toMain = refspecs.some((r) => ["main", "refs/heads/main"].includes(r.replace(/^\+/, "").split(":").pop()));
    if (toMain || (positional.length <= 1 && ctx.io.currentBranch() === "main"))
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

function deleteRows(args, ctx, add) {
  const recursive = args.some((w) => /^-[a-zA-Z]*[rR]/.test(w) || w === "--recursive");
  if (!recursive) return;
  const outside = args
    .filter((w) => !w.startsWith("-"))
    .some((w) => isOutside(normalisePath(w, ctx.root)) || /^[$%]/.test(w));
  if (outside) add("deny", "recursive delete outside the repo is not allowed", true);
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

  for (const part of splitParts(command)) {
    const ws = cleanWords(words(part));
    if (!ws.length) continue;
    const cmd = cmdName(ws[0]);
    const args = ws.slice(1);

    if (ws.some((w) => [w, w.slice(w.indexOf("=") + 1)].some((s) => { const n = s.replace(/\\/g, "/"); return ENV_FILE.test(n) && !ENV_EXAMPLE.test(n); })))
      add("deny", ".env holds secrets; use .env.example", true);

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
    if (DELETE_CMDS.has(cmd)) deleteRows(args, ctx, add);
    if (["npm", "yarn", "bun"].includes(cmd)) packageManagerRow(cmd, args, add);

    if (cmd === "git") {
      const { sub, rest } = gitCmd(args);
      gitRows(sub, rest, ctx, add);
      if (sub === "commit") {
        emojiTexts.push(command);
        trailerTexts.push(command);
        for (const f of optValues(rest, ["--file"], ["-F"])) {
          const t = readBody(f);
          if (t != null) {
            emojiTexts.push(t);
            trailerTexts.push(t);
          }
        }
      }
    } else if (cmd === "gh") ghRows(args, { lane, io, readBody, emojiTexts, trailerTexts }, add);
  }

  if (emojiTexts.some((t) => EMOJI.test(t)))
    add("deny", "no emoji in commit messages or PRs (team rule); plain text only");
  if (trailerTexts.some((t) => TRAILER.test(t)))
    add("deny", "no AI trailers or boilerplate; declare AI use in the PR's AI use section (git.md)");
}

function ghRows(args, env, add) {
  const { lane, io, readBody, emojiTexts, trailerTexts } = env;
  const [group, action] = args;
  const rest = args.slice(2);
  const key = `${group} ${action}`;

  if (key === "pr merge") {
    const n = rest.find((w) => !w.startsWith("-")) ?? null;
    const author = io.prAuthor(n);
    const me = io.ghUser();
    if (!author || !me) add("ask", "could not check the PR author (gh failed); only the author merges");
    else if (author.toLowerCase() !== me.toLowerCase()) add("deny", "only the author merges");
  }
  if (key === "pr review" && rest.some((w) => w === "--approve" || w === "-a")) add("deny", "approvals are human");

  if (group === "issue" && ["close", "edit", "reopen"].includes(action)) {
    const hit = rest.some((w, i) => {
      if (!/^#?1$|\/issues\/1$/.test(w)) return false;
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
