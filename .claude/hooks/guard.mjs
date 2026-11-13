// PreToolUse guard (docs/setup.md section 4.2). decide() is pure and takes its I/O as ctx.io,
// so the tests run offline; the CLI at the bottom reads the hook JSON and prints ask or deny.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { classifyPath, isOutside, loadLanes, normalisePath, readSetting } from "./lib/lanes.mjs";
import { envHit, shellRows } from "./lib/guardShell.mjs";

const FILE_TOOLS = new Set(["Read", "Edit", "Write", "MultiEdit", "NotebookEdit"]);
const BANNED_SEGMENTS = new Set(["copy", "backup", "old", "final", "v2", "temp", "tmp", "untitled"]);
const ROOT_FILES = new Set([
  "README.md", "CLAUDE.md", "AGENTS.md", "LICENSE", ".gitignore", ".gitattributes", ".env.example",
  ".editorconfig", ".nvmrc", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml",
  "components.json", "vercel.json", "pyproject.toml", "uv.lock",
]);
const ROOT_PATTERNS = [/^tsconfig.*\.json$/, /^[^/]+\.config\.(js|cjs|mjs|ts)$/, /^\.prettierrc/, /^requirements.*\.txt$/];
const SCRATCH_OK = ["public/", "docs/", ".scratch/", ".review/"];
const SECRET_PATTERNS = [
  /(?<![A-Za-z0-9_-])(?:sk-ant-|sk-|nvapi-)[A-Za-z0-9_-]{10,}/g,
  /ghp_[A-Za-z0-9]{30,}/,
  /github_pat_[A-Za-z0-9_]{30,}/,
  /AKIA[A-Z0-9]{16}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY/,
];

/** The text a file tool call writes, for the secret scan. */
function writtenText(tool, ti) {
  if (tool === "Write") return ti.content;
  if (tool === "Edit") return ti.new_string;
  if (tool === "NotebookEdit") return ti.new_source;
  if (tool === "MultiEdit") return (ti.edits ?? []).map((e) => e.new_string ?? "").join("\n");
  return "";
}

function hasSecret(text) {
  if (typeof text !== "string") return false;
  const [token, ...others] = SECRET_PATTERNS;
  const long = [...text.matchAll(token)].some((m) => m[0].length >= 20);
  return long || others.some((re) => re.test(text));
}

function fileRows(input, ctx, add) {
  const tool = input.tool_name;
  const ti = input.tool_input ?? {};
  const raw = ti.file_path ?? ti.notebook_path;
  if (typeof raw !== "string" || !raw) return;
  const rel = normalisePath(raw, ctx.root);
  const lrel = rel.toLowerCase();
  const base = rel.split("/").pop();

  if (envHit(rel))
    add("deny", ".env holds secrets; use .env.example", true);
  if (tool === "Read") return;

  if (/(^|\/)secrets\//.test(lrel) || /\.pem$/.test(lrel) || /^id_rsa/.test(lrel.split("/").pop()))
    add("deny", "secrets and private keys must not be written by the agent", true);
  if (hasSecret(writtenText(tool, ti))) add("deny", "put it in .env and read it from the environment", true);

  const cls = classifyPath(rel, ctx.lanes);
  if (ctx.lanes && !["local", "open", "outside"].includes(cls.kind)) {
    if (!ctx.lane) add("ask", "set env.LANE in .claude/settings.local.json");
    if (cls.kind === "lane" && ctx.lane && cls.lane !== ctx.lane)
      add("ask", `${rel} belongs to lane ${cls.lane} (owner ${cls.owner}); talk to them or open a handoff`);
    if (cls.kind === "shared") add("ask", "shared path: agree the change with the affected lanes");
  }
  if (lrel === ".claude/lanes.json")
    add("ask", "lane map: change it together with the Lanes table in CLAUDE.md, with the team's agreement");
  if (lrel.startsWith(".claude/hooks/") || lrel === ".claude/settings.json")
    add("ask", "harness file: it decides what every agent may do; agree the change with the team");

  if (tool !== "Write") return;
  const segments = base.toLowerCase().split(/[-_. ]+/);
  if (segments.some((s) => BANNED_SEGMENTS.has(s))) add("deny", "name it for what it is (structure.md)");
  const rootFile = !isOutside(rel) && !rel.includes("/");
  if (rootFile && !ROOT_FILES.has(rel) && !ROOT_PATTERNS.some((re) => re.test(rel)) && !ctx.io.fileExists(resolve(ctx.root, rel)))
    add("ask", "put it in a folder, or add it to the File tree in CLAUDE.md first");
  const scratchy = /\.(png|jpe?g|gif|webp|bmp|log)$/i.test(base) || segments.includes("scratch");
  if (scratchy && !isOutside(rel) && !SCRATCH_OK.some((p) => lrel.startsWith(p)))
    add("ask", "scratch goes in .scratch/ (gitignored)");
}

/**
 * @param input hook JSON ({tool_name, tool_input, cwd})
 * @param ctx {root, lane, guardMode, lanes, io}
 * @returns null (allow) or {decision: "ask" | "deny", reason}
 */
export function decide(input, ctx) {
  const findings = [];
  const lite = ctx.guardMode === "lite";
  const add = (decision, reason, safety = false) => {
    if (!lite || safety) findings.push({ decision, reason });
  };
  const tool = input?.tool_name;
  if (FILE_TOOLS.has(tool)) fileRows(input, ctx, add);
  else if (tool === "Grep") {
    const ti = input.tool_input ?? {};
    if ([ti.path, ti.glob].some((v) => typeof v === "string" && envHit(normalisePath(v, ctx.root))))
      add("deny", ".env holds secrets; use .env.example", true);
  }
  else if (tool === "Bash" || tool === "PowerShell") {
    const command = input.tool_input?.command;
    if (typeof command === "string") shellRows(command, ctx, input, add);
  }
  const pick = (kind) => [...new Set(findings.filter((f) => f.decision === kind).map((f) => f.reason))];
  for (const decision of ["deny", "ask"]) {
    const reasons = pick(decision);
    if (reasons.length) return { decision, reason: reasons.join("; ") };
  }
  return null;
}

/** decide() that never throws: an internal error becomes an ask. */
export function safeDecide(input, ctx) {
  try {
    return decide(input, ctx);
  } catch (err) {
    return { decision: "ask", reason: `guard error: ${err?.message ?? err}` };
  }
}

function run(cmd, args, cwd, timeout = 5000) {
  try {
    const out = execFileSync(cmd, args, { cwd, timeout, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
    return out.trim() || null;
  } catch {
    return null;
  }
}

function realIo(root) {
  return {
    readFile: (p) => {
      try {
        return readFileSync(p, "utf8");
      } catch {
        return null;
      }
    },
    fileExists: (p) => existsSync(p),
    currentBranch: () => run("git", ["rev-parse", "--abbrev-ref", "HEAD"], root),
    ghUser: () => run("gh", ["api", "user", "--jq", ".login"], root, 3000),
    prAuthor: (n) => run("gh", ["pr", "view", ...(n ? [n] : []), "--json", "author", "--jq", ".author.login"], root, 3000),
  };
}

function main() {
  let input = {};
  let result;
  try {
    if (!process.stdin.isTTY) {
      const text = readFileSync(0, "utf8").replace(/^﻿/, "");
      if (text.trim()) input = JSON.parse(text);
    }
    const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
    result = safeDecide(input, {
      root,
      lane: readSetting("LANE", root),
      guardMode: readSetting("GUARD", root),
      lanes: loadLanes(root),
      io: realIo(root),
    });
  } catch (err) {
    result = { decision: "ask", reason: `guard error: ${err?.message ?? err}` };
  }
  if (result)
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: result.decision, permissionDecisionReason: result.reason },
      }),
    );
}

const self = process.argv[1] ? pathToFileURL(process.argv[1]).href.toLowerCase() : "";
if (import.meta.url.toLowerCase() === self) main();
