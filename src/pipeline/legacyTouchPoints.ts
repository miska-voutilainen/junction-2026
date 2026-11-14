/**
 * Legacy guard, touch points: every place a change reaches what old systems rely
 * on becomes a touch point with a kind, a named owner and a guard, the evidence
 * that the touch is safe. The guard differs per kind: tests at the base commit
 * for legacy code, the test projects' targets for old-platform code, release
 * notes for a consumer contract. Git and path/text rules only, no model, so the
 * owner can follow every line. Tests at base predate the change, so the agent
 * that wrote it did not write them (the author never checks its own work).
 * Spec section 5, Policy.
 */
import type { LegacyTouchKind, LegacyTouchPoint, Review } from "../contracts";
import { readFileAtCommit } from "../lib/git";
import { runGit } from "../lib/git/runGit";
import { matchesGlob } from "../policy/globMatch";
import { legacyZoneOf, legacyZones } from "../policy/legacy";
import {
  buildGlobs,
  consumerContractGlobs,
  consumerNoteGlobs,
  ignoredSymbolNames,
  legacyTargetFramework,
  maintainersOwner,
  maxListedFiles,
  oldPlatformDirective,
} from "../policy/legacyTouch";

type Hunk = Review["hunks"][number];
type Guard = LegacyTouchPoint["guard"];

/** What the detectors read from the base commit; a test passes a fake. */
export interface BaseTree {
  /** Paths under the pathspecs whose text contains the whole word. */
  filesMentioning(word: string, pathspecs: string[]): Promise<string[]>;
  /** Symbols declared in files under the pathspecs, each with the first file declaring it. */
  declaredSymbolsIn(pathspecs: string[]): Promise<Map<string, string>>;
  /** The file at the base commit, or null. */
  readFile(path: string): Promise<string | null>;
  /** Every path under a folder at the base commit. */
  listFiles(folder: string): Promise<string[]>;
}

/** One place in one hunk that touches something legacy, before hunks are grouped. */
interface Sighting {
  detail: string;
  owner: string;
  hunkId: string;
  /** What the guard looks up: a symbol, a type name or a source project. */
  subject: string;
}

/**
 * All touch points of a change, in kind order. Pure rules over the hunks and
 * the files at the base commit.
 * @param input.files the change's files (their paths decide consumer and build touches)
 */
export async function findLegacyTouchPoints(
  input: { repoDir: string; baseSha: string; files: Review["files"]; hunks: Review["hunks"] },
  tree: BaseTree = gitBaseTree(input.repoDir, input.baseSha),
): Promise<LegacyTouchPoint[]> {
  const { files, hunks } = input;
  return [
    ...(await legacyCodeTouchPoints(hunks, tree)),
    ...(await oldPlatformTouchPoints(hunks, tree)),
    ...consumerContractTouchPoints(files, hunks),
    ...buildTouchPoints(hunks),
  ];
}

// --- legacy-code: a hunk in a zone, or a reach-in from outside it ---

async function legacyCodeTouchPoints(
  hunks: readonly Hunk[],
  tree: BaseTree,
): Promise<LegacyTouchPoint[]> {
  const sightings = [...zoneSightings(hunks), ...(await reachInSightings(hunks, tree))];
  return groupSightings("legacy-code", sightings, async ([symbol]) => guardByTests(symbol, tree));
}

/** One sighting per zone hunk; the subject is the file's type name, which tests name when they cover it. */
function zoneSightings(hunks: readonly Hunk[]): Sighting[] {
  return hunks.flatMap((hunk) => {
    const zone = legacyZoneOf(hunk.file);
    if (!zone) return [];
    const typeName =
      hunk.file
        .split("/")
        .pop()
        ?.replace(/\.\w+$/, "") ?? hunk.file;
    return [
      {
        detail: `${zone.label}: ${hunk.file}`,
        owner: zone.owner,
        hunkId: hunk.id,
        subject: typeName,
      },
    ];
  });
}

const zonePathspecs = legacyZones.flatMap((zone) => zone.globs.map((glob) => `:(glob)${glob}`));

/**
 * A hunk outside the zones that declares or removes a symbol zone files use
 * ("called from"), or adds a call to a symbol zone files declare ("calls into").
 * Only `.cs` under src/: a test calling legacy code does not change it.
 */
async function reachInSightings(hunks: readonly Hunk[], tree: BaseTree): Promise<Sighting[]> {
  const outside = hunks.filter(
    (hunk) => /^src\/.*\.cs$/.test(hunk.file) && legacyZoneOf(hunk.file) === null,
  );
  const sightings: Sighting[] = [];
  let zoneSymbols: Map<string, string> | null = null;
  for (const hunk of outside) {
    for (const symbol of changedDeclarations(hunk)) {
      const [zoneFile] = await tree.filesMentioning(symbol, zonePathspecs);
      if (zoneFile) sightings.push(reachIn(hunk, symbol, "called from", zoneFile));
    }
    const calls = addedCalls(hunk);
    if (calls.length === 0) continue;
    zoneSymbols ??= await tree.declaredSymbolsIn(zonePathspecs);
    for (const symbol of calls) {
      const zoneFile = zoneSymbols.get(symbol);
      if (zoneFile) sightings.push(reachIn(hunk, symbol, "calls into", zoneFile));
    }
  }
  return sightings;
}

function reachIn(hunk: Hunk, symbol: string, direction: string, zoneFile: string): Sighting {
  const zone = legacyZoneOf(zoneFile);
  return {
    detail: `${symbol}: ${direction} ${zone?.label ?? zoneFile}`,
    owner: zone?.owner ?? maintainersOwner.platform,
    hunkId: hunk.id,
    subject: symbol,
  };
}

/**
 * A C# type or method declaration with an access modifier, capturing its name.
 * Fields and properties are left out: a call can't name them, and a field called
 * `writer` would make every `writer(...)` delegate call look like a reach in.
 * @example "public static Foo<T, U>? Bar<T>(" captures "Bar"; "internal sealed class Baz" captures "Baz"
 */
const declarationPattern =
  /\b(?:public|internal|protected|private)\s+(?:(?:static|virtual|override|abstract|sealed|async|partial|readonly|unsafe|new)\s+)*(?:(?:class|struct|interface|enum|record)\s+(\w+)|[\w.]+(?:<[^>]*>)?(?:\[\])*\??\s+(\w+)\s*(?:<[^>]*>)?\s*\()/;

/** Symbols declared on the hunk's added or removed lines (a changed signature shows as both). */
export function changedDeclarations(hunk: Hunk): string[] {
  const names = hunk.lines
    .filter((line) => line.kind !== "context")
    .map((line) => declarationPattern.exec(line.text))
    .flatMap((match) => (match ? [match[1] ?? match[2]] : []))
    .filter((name) => !ignoredSymbolNames.has(name));
  return [...new Set(names)];
}

/**
 * A call: a name followed by "(", not an object creation and not a call on
 * `this.`, which is the type's own method and not a reach into another type.
 * @example "writer.Write(x)" yields "Write"; "this.Write(x)" and "new Foo()" yield nothing.
 */
const callPattern = /(?<!this\.)(?<!new\s)\b([A-Za-z_]\w*)\s*\(/g;

/** Symbols the hunk's added lines call, declarations and comments excluded. */
export function addedCalls(hunk: Hunk): string[] {
  const names = hunk.lines
    .filter((line) => line.kind === "add" && !declarationPattern.test(line.text))
    .filter((line) => !line.text.trimStart().startsWith("//"))
    .flatMap((line) => [...line.text.matchAll(callPattern)].map((match) => match[1]))
    .filter((name) => !ignoredSymbolNames.has(name));
  return [...new Set(names)];
}

/** Test files at the base commit that name the symbol: they predate the change, so the author did not write them. */
async function guardByTests(symbol: string, tree: BaseTree): Promise<Guard> {
  const found = (await tree.filesMentioning(symbol, ["tests"])).filter((file) =>
    file.endsWith(".cs"),
  );
  if (found.length === 0)
    return {
      status: "unguarded",
      evidence: `no test at the base commit names ${symbol}`,
      files: [],
    };
  return {
    status: "guarded",
    evidence: `${found.length} ${found.length === 1 ? "test file" : "test files"} at the base commit name ${symbol}`,
    files: found.slice(0, maxListedFiles),
  };
}

// --- old-platform: #if for a target only old systems build ---

async function oldPlatformTouchPoints(
  hunks: readonly Hunk[],
  tree: BaseTree,
): Promise<LegacyTouchPoint[]> {
  const sightings = hunks.flatMap((hunk) => {
    const project = hunk.file.match(/^src\/([^/]+)\//)?.[1];
    const directive = hunk.lines
      .filter((line) => line.kind !== "context" && oldPlatformDirective.test(line.text))
      .map((line) => line.text.trim())[0];
    if (!project || !directive) return [];
    return [
      { detail: directive, owner: maintainersOwner.platform, hunkId: hunk.id, subject: project },
    ];
  });
  return groupSightings("old-platform", sightings, (projects) =>
    guardByTestTargets(projects, tree),
  );
}

/** One target a test project builds for. */
interface Target {
  framework: string;
  /** Under a Condition, e.g. Windows only: a machine that doesn't meet it never runs it. */
  isConditional: boolean;
}

/**
 * Targets a csproj builds for. Properties that are not a plain framework name
 * (`$(TargetFrameworks)`) are skipped.
 * @example `<TargetFrameworks Condition="...Windows...">net472</TargetFrameworks>` gives [{ framework: "net472", isConditional: true }]
 */
export function parseTargets(csproj: string): Target[] {
  const groups = csproj.matchAll(/<PropertyGroup([^>]*)>([\s\S]*?)<\/PropertyGroup>/g);
  return [...groups].flatMap(([, groupAttributes, body]) =>
    [...body.matchAll(/<TargetFrameworks?([^>]*)>([^<]*)</g)].flatMap(([, attributes, value]) =>
      value
        .split(";")
        .filter((framework) => /^net/i.test(framework))
        .map((framework) => ({
          framework,
          isConditional: /Condition=/.test(groupAttributes) || /Condition=/.test(attributes),
        })),
    ),
  );
}

/** The test projects for the touched source projects and what they target; a legacy target must be built, not conditional, to run. */
async function guardByTestTargets(sourceProjects: string[], tree: BaseTree): Promise<Guard> {
  const csprojs = (await tree.listFiles("tests")).filter((path) =>
    sourceProjects.some(
      (project) =>
        path.startsWith(`tests/${project}`) && /^tests\/[^/]+\/[^/]+\.csproj$/.test(path),
    ),
  );
  const described: string[] = [];
  let hasUnconditional = false;
  let hasConditional = false;
  for (const csproj of csprojs) {
    const targets = parseTargets((await tree.readFile(csproj)) ?? "");
    const legacy = targets.filter((target) => legacyTargetFramework.test(target.framework));
    hasUnconditional ||= legacy.some((target) => !target.isConditional);
    hasConditional ||= legacy.some((target) => target.isConditional);
    const names = targets.map(
      (target) => target.framework + (target.isConditional ? " (conditional)" : ""),
    );
    described.push(
      `${csproj.split("/").slice(0, 2).join("/")} targets ${names.join(", ") || "no plain framework"}`,
    );
  }
  const files = csprojs.slice(0, maxListedFiles);
  const evidence =
    described.length > 0
      ? described.join("; ")
      : `no test project under tests/ matches ${sourceProjects.join(", ")}`;
  if (hasUnconditional) return { status: "guarded", evidence, files };
  if (hasConditional)
    return {
      status: "partly",
      evidence: `a test project targets an old platform only under a condition: ${evidence}`,
      files,
    };
  return {
    status: "unguarded",
    evidence: `no test runs it on netstandard or .NET Framework: ${evidence}`,
    files,
  };
}

// --- consumer-contract and build: decided by path ---

function consumerContractTouchPoints(
  files: Review["files"],
  hunks: readonly Hunk[],
): LegacyTouchPoint[] {
  const touched = hunks.filter((hunk) => matchesAny(consumerContractGlobs, hunk.file));
  if (touched.length === 0) return [];
  const notes = files
    .map((file) => file.path)
    .filter((path) => matchesAny(consumerNoteGlobs, path));
  const guard: Guard =
    notes.length > 0
      ? {
          status: "guarded",
          evidence: `the same change updates ${summarise(notes)}`,
          files: notes.slice(0, maxListedFiles),
        }
      : { status: "unguarded", evidence: "no release note or doc tells old consumers", files: [] };
  return [touchPoint("consumer-contract", touched, maintainersOwner.api, guard)];
}

function buildTouchPoints(hunks: readonly Hunk[]): LegacyTouchPoint[] {
  const touched = hunks.filter((hunk) => matchesAny(buildGlobs, hunk.file));
  if (touched.length === 0) return [];
  const guard: Guard = {
    status: "owner-read",
    evidence: "no test shows what a build change does to old targets",
    files: [],
  };
  return [touchPoint("build", touched, maintainersOwner.build, guard)];
}

function touchPoint(
  kind: LegacyTouchKind,
  hunks: Hunk[],
  owner: string,
  guard: Guard,
): LegacyTouchPoint {
  const paths = [...new Set(hunks.map((hunk) => hunk.file))];
  return { kind, hunkIds: hunks.map((hunk) => hunk.id), detail: summarise(paths), owner, guard };
}

function matchesAny(globs: readonly string[], path: string): boolean {
  return globs.some((glob) => matchesGlob(glob, path));
}

/** "a.cs, b.cs, c.cs and 2 more": file names, so a touch point reads on one line. */
function summarise(paths: readonly string[]): string {
  const names = [...new Set(paths.map((path) => path.split("/").pop() ?? path))];
  const shown = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${shown} and ${names.length - 3} more` : shown;
}

// --- shared ---

/** One touch point per detail, in first-seen order, its guard computed once from the subjects seen. */
async function groupSightings(
  kind: LegacyTouchKind,
  sightings: readonly Sighting[],
  guardOf: (subjects: string[]) => Promise<Guard>,
): Promise<LegacyTouchPoint[]> {
  const details = [...new Set(sightings.map((sighting) => sighting.detail))];
  return Promise.all(
    details.map(async (detail) => {
      const group = sightings.filter((sighting) => sighting.detail === detail);
      return {
        kind,
        hunkIds: [...new Set(group.map((sighting) => sighting.hunkId))],
        detail,
        owner: group[0].owner,
        guard: await guardOf([...new Set(group.map((sighting) => sighting.subject))]),
      };
    }),
  );
}

// --- the base commit, read through git ---

function gitBaseTree(repoDir: string, baseSha: string): BaseTree {
  const git = async (args: string[]) =>
    (await runGit(repoDir, args, { isolated: true })).toString();
  // `git grep` exits 1 when nothing matches; node reports that as "Command failed" with no git
  // stderr, which is the one failure that means "no result" and not "broken repository".
  const grep = async (args: string[], pathspecs: string[]): Promise<string[]> => {
    try {
      return (await git(["grep", ...args, baseSha, "--", ...pathspecs]))
        .split("\n")
        .filter(Boolean);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Command failed")) return [];
      throw error;
    }
  };
  const withoutSha = (line: string) => line.slice(baseSha.length + 1);
  return {
    filesMentioning: async (word, pathspecs) =>
      (await grep(["-l", "-w", "-I", "-e", word], pathspecs)).map(withoutSha),
    declaredSymbolsIn: async (pathspecs) => {
      const symbols = new Map<string, string>();
      for (const line of await grep(
        ["-I", "-E", "-e", "(public|internal|protected|private)[[:space:]]"],
        pathspecs,
      )) {
        const [path, ...text] = withoutSha(line).split(":");
        const match = declarationPattern.exec(text.join(":"));
        const name = match?.[1] ?? match?.[2];
        if (name && !symbols.has(name)) symbols.set(name, path);
      }
      return symbols;
    },
    readFile: (path) => readFileAtCommit(repoDir, baseSha, path),
    listFiles: async (folder) =>
      (await git(["ls-tree", "-r", "--name-only", baseSha, "--", folder]))
        .split("\n")
        .filter(Boolean),
  };
}
