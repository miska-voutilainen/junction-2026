/**
 * Legacy guard, touch points: every place a change reaches what old systems
 * rely on becomes a touch point with a kind, a named owner and a guard, the
 * evidence that the touch is safe. The guard differs per kind: tests at the base
 * commit for legacy code, the test projects' targets for old-platform code,
 * release notes for a consumer contract. Git and path or text rules only, no
 * model, so the owner can follow every line. Tests at the base commit predate
 * the change, so the agent that wrote it did not write them (the author never
 * checks its own work). Spec section 5, Policy.
 *
 * This module finds legacy-code touches and runs every detector; the other kinds
 * live in oldPlatformTouchPoints.ts and contractTouchPoints.ts.
 */
import type { LegacyTouchPoint, Review } from "../contracts";
import { gitBaseTree, type BaseTree } from "../lib/git/baseTree";
import { legacyZoneOf, legacyZones } from "../policy/legacy";
import { maintainersOwner, maxListedFiles } from "../policy/legacyTouch";
import { buildTouchPoints, consumerContractTouchPoints } from "./contractTouchPoints";
import { addedCalls, changedDeclarations, declaredName } from "./csharpSymbols";
import { oldPlatformTouchPoints } from "./oldPlatformTouchPoints";
import { groupSightings, type Guard, type Hunk, type Sighting } from "./touchSightings";

/**
 * All touch points of a change, in kind order: legacy code, old platform,
 * consumer contract, build.
 * @param input.files the change's files (release notes among them guard a contract touch)
 * @param tree what the guards read from the base commit; tests pass a fake
 */
export async function findLegacyTouchPoints(
  input: { repoDir: string; baseSha: string; files: Review["files"]; hunks: Review["hunks"] },
  tree: BaseTree = gitBaseTree(input.repoDir, input.baseSha),
): Promise<LegacyTouchPoint[]> {
  const { files, hunks } = input;
  return [
    ...(await legacyCodeTouchPoints(files, hunks, tree)),
    ...(await oldPlatformTouchPoints(hunks, tree)),
    ...consumerContractTouchPoints(files, hunks),
    ...buildTouchPoints(hunks),
  ];
}

/** A hunk in a zone, or a reach into one by name from outside it, guarded by tests that name it. */
async function legacyCodeTouchPoints(
  files: Review["files"],
  hunks: readonly Hunk[],
  tree: BaseTree,
): Promise<LegacyTouchPoint[]> {
  const sightings = [
    ...zoneSightings(hunks),
    ...hunklessZoneSightings(files, hunks),
    ...(await reachInSightings(hunks, tree)),
  ];
  return groupSightings("legacy-code", sightings, async ([symbol]) => guardByTests(symbol, tree));
}

/**
 * One sighting per zone hunk; the subject is the file's type name, which tests
 * name when they cover it.
 * @example a hunk in "src/MessagePack/MessagePackReader.Integers.cs" gives subject "MessagePackReader"
 */
function zoneSightings(hunks: readonly Hunk[]): Sighting[] {
  return hunks.flatMap((hunk) => zoneSighting(hunk.file, hunk.id));
}

/**
 * One sighting per zone file the change touches with no hunk: a binary file or
 * a mode change. Detectors read hunks, so without this the zone's owner would
 * never hear of a replaced DLL in the Unity client.
 * @example a file "src/MessagePack.UnityClient/Assets/Plugin.dll" with no hunks gives detail "Unity client: src/MessagePack.UnityClient/Assets/Plugin.dll (no text hunks: binary, mode change or rename)"
 */
function hunklessZoneSightings(files: Review["files"], hunks: readonly Hunk[]): Sighting[] {
  const filesWithHunks = new Set(hunks.map((hunk) => hunk.file));
  return files
    .filter((file) => !filesWithHunks.has(file.path))
    .flatMap((file) =>
      zoneSighting(file.path, null, " (no text hunks: binary, mode change or rename)"),
    );
}

/**
 * The sighting for a path in a zone, or none. A partial class file names its
 * type before the first dot: tests name `MessagePackReader`, never
 * `MessagePackReader.Integers`, so the whole file name would always read as unguarded.
 */
function zoneSighting(path: string, hunkId: string | null, note = ""): Sighting[] {
  const zone = legacyZoneOf(path);
  if (!zone) return [];
  const fileName = path.split("/").pop() ?? path;
  return [
    {
      detail: `${zone.label}: ${path}${note}`,
      owner: zone.owner,
      hunkId,
      subject: fileName.split(".")[0],
    },
  ];
}

/** The zones as git pathspecs, e.g. ":(glob)src/MessagePack/MessagePackWriter.cs". */
const zonePathspecs = legacyZones.flatMap((zone) => zone.globs.map((glob) => `:(glob)${glob}`));

/**
 * A hunk outside the zones that declares or removes a symbol zone files use
 * ("called from"), or adds a call to a symbol zone files declare ("calls into").
 * Name matching, not type resolution: coarse, but a false touch costs one read
 * and never lets a hunk skip one. Only `.cs` under src/: a test calling legacy
 * code does not change it. A declaration whose name another file outside the
 * zones also declares is skipped: name matching can't tell which one a zone
 * file uses, and every formatter's `Serialize` would read as called from the
 * reflection resolvers.
 */
async function reachInSightings(hunks: readonly Hunk[], tree: BaseTree): Promise<Sighting[]> {
  const outside = hunks.filter(
    (hunk) => /^src\/.*\.cs$/.test(hunk.file) && legacyZoneOf(hunk.file) === null,
  );
  const sightings: Sighting[] = [];
  // Read each set of declarations only once, and only when a hunk needs it.
  let zoneSymbols: Map<string, string> | null = null;
  let declaredOutside: Map<string, Set<string>> | null = null;
  for (const hunk of outside) {
    for (const symbol of changedDeclarations(hunk)) {
      declaredOutside ??= await outsideDeclarations(tree);
      const declaringFiles = [...(declaredOutside.get(symbol) ?? [])];
      if (declaringFiles.some((path) => path !== hunk.file)) continue;
      const [zoneFile] = await tree.filesMentioning(symbol, zonePathspecs);
      if (zoneFile) sightings.push(reachIn(hunk, symbol, "called from", zoneFile));
    }
    const calls = addedCalls(hunk);
    if (calls.length === 0) continue;
    zoneSymbols ??= await zoneDeclarations(tree);
    for (const symbol of calls) {
      const zoneFile = zoneSymbols.get(symbol);
      if (zoneFile) sightings.push(reachIn(hunk, symbol, "calls into", zoneFile));
    }
  }
  return sightings;
}

/** Each type or method the zone files declare at the base commit, with the first zone file declaring it. */
async function zoneDeclarations(tree: BaseTree): Promise<Map<string, string>> {
  const symbols = new Map<string, string>();
  for (const { path, text } of await tree.accessModifierLines(zonePathspecs)) {
    const name = declaredName(text);
    if (name && !symbols.has(name)) symbols.set(name, path);
  }
  return symbols;
}

/** For each type or method name, the source files outside the zones that declare it at the base commit. */
async function outsideDeclarations(tree: BaseTree): Promise<Map<string, Set<string>>> {
  const declaring = new Map<string, Set<string>>();
  for (const { path, text } of await tree.accessModifierLines([":(glob)src/**/*.cs"])) {
    const name = declaredName(text);
    if (!name || legacyZoneOf(path) !== null) continue;
    declaring.set(name, (declaring.get(name) ?? new Set<string>()).add(path));
  }
  return declaring;
}

/** A reach-in sighting, owned by the zone the symbol lives in. */
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
 * Guarded when a test file at the base commit names the symbol. Those tests
 * predate the change, so the author did not write them. Naming is not proof
 * the test checks the behaviour that matters; running them on base and head
 * is the next step (not built).
 */
async function guardByTests(symbol: string, tree: BaseTree): Promise<Guard> {
  const testFiles = (await tree.filesMentioning(symbol, ["tests"])).filter((file) =>
    file.endsWith(".cs"),
  );
  if (testFiles.length === 0) {
    return {
      status: "unguarded",
      evidence: `no test at the base commit names ${symbol}`,
      files: [],
    };
  }
  const count = testFiles.length === 1 ? "1 test file" : `${testFiles.length} test files`;
  return {
    status: "guarded",
    evidence: `${count} at the base commit name ${symbol}`,
    files: testFiles.slice(0, maxListedFiles),
  };
}
