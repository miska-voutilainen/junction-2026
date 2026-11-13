// Shared lane logic for the hooks and CI: reads .claude/lanes.json, normalises paths,
// and classifies a repo path as local, shared, open, a lane's, outside or unmatched.
// Matching order (docs/setup.md section 3): settings.local.json → shared → open → lanes.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const LOCAL_SETTINGS = ".claude/settings.local.json";

/**
 * Converts a lanes.json glob to a RegExp anchored at both ends.
 * Two stars followed by a slash match zero or more folders, two trailing stars match
 * anything, one star stays inside one folder, `?` is one character.
 */
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        if (glob[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 2;
        } else {
          re += ".*";
          i += 1;
        }
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${re}$`);
}

/** True when the repo-relative path matches the glob. */
export function matchesGlob(relPath, glob) {
  return globToRegExp(glob).test(relPath);
}

function comparable(p) {
  return p.replace(/^\/([a-zA-Z])\//, "$1:/").toLowerCase();
}

/**
 * Turns an absolute or relative path into a repo-relative one with forward slashes.
 * Strips the root prefix case-insensitively (Windows sends `C:\…`, sometimes lower-cased,
 * Git Bash sends `/c/…`) and a leading `./`. Paths outside the root stay absolute.
 */
export function normalisePath(path, root) {
  let p = String(path ?? "").replace(/\\/g, "/");
  if (root) {
    const r = String(root).replace(/\\/g, "/").replace(/\/+$/, "");
    const cp = comparable(p);
    const cr = comparable(r);
    if (cp === cr) p = "";
    else if (cp.startsWith(`${cr}/`)) p = p.slice(cr.length + 1);
  }
  return p.replace(/^(\.\/)+/, "");
}

/** True when a normalised path points outside the repo (absolute or climbing with `..`). */
export function isOutside(relPath) {
  return /^([a-zA-Z]:\/|\/|~)/.test(relPath) || relPath === ".." || relPath.startsWith("../");
}

/** Reads .claude/lanes.json from the repo root, or null when it doesn't exist or can't be parsed. */
export function loadLanes(root) {
  const file = join(root, ".claude", "lanes.json");
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

/**
 * Classifies a repo-relative path.
 * @returns {{kind: "local"} | {kind: "shared"} | {kind: "open"} | {kind: "lane", lane: string, owner: string}
 *   | {kind: "outside"} | {kind: "unmatched"}}
 */
export function classifyPath(relPath, config) {
  if (isOutside(relPath)) return { kind: "outside" };
  if (relPath === LOCAL_SETTINGS) return { kind: "local" };
  if (!config) return { kind: "unmatched" };
  if ((config.shared ?? []).some((g) => matchesGlob(relPath, g))) return { kind: "shared" };
  if ((config.open ?? []).some((g) => matchesGlob(relPath, g))) return { kind: "open" };
  for (const [lane, def] of Object.entries(config.lanes ?? {})) {
    if ((def.paths ?? []).some((g) => matchesGlob(relPath, g))) {
      return { kind: "lane", lane, owner: def.owner };
    }
  }
  return { kind: "unmatched" };
}

/** The lanes (plus "shared") a list of repo-relative files touches; open and local paths are ignored. */
export function lanesTouched(files, config) {
  const touched = new Set();
  for (const f of files) {
    const c = classifyPath(f, config);
    if (c.kind === "lane") touched.add(c.lane);
    else if (c.kind === "shared") touched.add("shared");
  }
  return [...touched].sort();
}

/**
 * Reads a setting from the environment first, then from `env` in .claude/settings.local.json.
 * An empty string counts as unset (returns undefined).
 */
export function readSetting(name, root, env = process.env) {
  const fromEnv = env[name];
  if (typeof fromEnv === "string" && fromEnv.trim() !== "") return fromEnv.trim();
  const file = join(root, LOCAL_SETTINGS);
  if (!existsSync(file)) return undefined;
  try {
    const value = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""))?.env?.[name];
    return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** Checks lanes.json against the Lanes table in CLAUDE.md: same lane names and owners. Returns problems found. */
export function compareWithClaudeMd(config, claudeMd) {
  const problems = [];
  const rows = [...claudeMd.matchAll(/^\| *([a-z][a-z0-9-]*) *\| *`([^`]+)` *\|/gm)].map((m) => ({
    lane: m[1],
    owner: m[2],
  }));
  const tableLanes = new Map(rows.map((r) => [r.lane, r.owner]));
  for (const [lane, def] of Object.entries(config.lanes ?? {})) {
    if (!tableLanes.has(lane)) problems.push(`lane "${lane}" is in lanes.json but not in the CLAUDE.md Lanes table`);
    else if (tableLanes.get(lane) !== def.owner)
      problems.push(`lane "${lane}": owner ${def.owner} in lanes.json, ${tableLanes.get(lane)} in CLAUDE.md`);
  }
  for (const lane of tableLanes.keys()) {
    if (!(lane in (config.lanes ?? {}))) problems.push(`lane "${lane}" is in CLAUDE.md but not in lanes.json`);
  }
  return problems;
}
