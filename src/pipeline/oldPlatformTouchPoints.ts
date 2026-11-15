/**
 * Legacy guard, old-platform touches: code behind an `#if` that only old
 * targets (.NET Framework, netstandard, Unity) compile. CI on a modern target
 * never builds it, so the guard asks whether any test project for that code
 * runs on an old target. On Tieto's mp-2297 none does: every source-generator
 * test project targets net8.0 only. Spec section 5, Policy.
 */
import type { LegacyTouchPoint } from "../contracts";
import type { BaseTree } from "../lib/git/baseTree";
import {
  currentPlatformIf,
  legacyTargetFramework,
  maintainersOwner,
  maxListedFiles,
  oldOnlyCondition,
  oldPlatformDirective,
  preprocessor,
} from "../policy/legacyTouch";
import { groupSightings, type Guard, type Hunk, type Sighting } from "./touchSightings";

/**
 * One touch point per old-platform directive, guarded by the targets of the
 * touched projects' test projects at the base commit.
 */
export async function oldPlatformTouchPoints(
  hunks: readonly Hunk[],
  tree: BaseTree,
): Promise<LegacyTouchPoint[]> {
  const sightings = hunks.flatMap(directiveSighting);
  return groupSightings("old-platform", sightings, (projects) =>
    guardByTestTargets(projects, tree),
  );
}

/**
 * The hunk's old-platform directive as a sighting, with its source project as
 * the subject the guard looks up.
 * @example a hunk in "src/MessagePack.SourceGenerator/X.cs" adding "#if !NETFRAMEWORK" gives subject "MessagePack.SourceGenerator"
 */
function directiveSighting(hunk: Hunk): Sighting[] {
  const project = hunk.file.match(/^src\/([^/]+)\//)?.[1];
  const directive = firstOldPlatformDirective(hunk.lines);
  if (!project || !directive) return [];
  return [
    { detail: directive, owner: maintainersOwner.platform, hunkId: hunk.id, subject: project },
  ];
}

/**
 * The first changed line that only old targets compile: an old-platform `#if`,
 * an `#else` of an `#if` on one current target, or any line inside an old-only
 * block whose directive is only context. The first stands for the hunk: a hunk
 * that changes several such lines asks the owner the same question.
 * @example a hunk with context "#if NET8_0_OR_GREATER" and an added "#else" gives "#else of #if NET8_0_OR_GREATER"
 * @example a hunk with context "#if NETFRAMEWORK" and an added "LegacyOnly();" gives "#if NETFRAMEWORK"
 */
function firstOldPlatformDirective(lines: Hunk["lines"]): string | null {
  const enclosing = enclosingOldOnlyBranches(lines);
  for (const [index, line] of lines.entries()) {
    if (line.kind === "context") continue;
    if (oldPlatformDirective.test(line.text)) return line.text.trim();
    if (preprocessor.elseLine.test(line.text)) {
      const opening = openingIf(lines, index);
      if (opening && currentPlatformIf.test(opening)) return `#else of ${opening}`;
      // Not that kind of #else: it may still sit inside an outer old-only block.
    }
    if (enclosing[index]) return enclosing[index];
  }
  return null;
}

/** An `#if` block open at some line: its opening, and the branch the line sits in. */
interface OpenBlock {
  opening: string;
  /** The `#elif` or `#else` last passed in this block, or null while still under the `#if`. */
  branch: string | null;
  /** An `#else` after an `#elif` also runs when the `#elif` fails, so it is not the pure negation of the `#if`. */
  hasElif: boolean;
}

/**
 * For each line, the innermost old-only branch it sits in, or null. One
 * forward pass per version of the file (context plus added lines, context plus
 * removed lines) with a stack of open blocks, so a hunk costs one walk however
 * many lines it changes. A block opened above the hunk is not seen, so a line
 * deep inside a long old-only block can still be missed.
 * @example context "#if NETFRAMEWORK", "#if DEBUG", "#endif" then an added "Old();" gives "#if NETFRAMEWORK" for the last line
 */
function enclosingOldOnlyBranches(lines: Hunk["lines"]): (string | null)[] {
  const branches: (string | null)[] = lines.map(() => null);
  for (const version of ["add", "del"] as const) {
    const open: OpenBlock[] = [];
    for (const [index, { kind, text }] of lines.entries()) {
      if (kind !== "context" && kind !== version) continue;
      // Read before this line's own directive applies: an added "#else" sits in the blocks around it.
      if (kind === version) branches[index] = innermostOldOnly(open);
      const top = open.at(-1);
      if (preprocessor.ifLine.test(text))
        open.push({ opening: text.trim(), branch: null, hasElif: false });
      else if (preprocessor.elifLine.test(text) && top)
        Object.assign(top, { branch: text.trim(), hasElif: true });
      else if (preprocessor.elseLine.test(text) && top) top.branch = text.trim();
      else if (preprocessor.endifLine.test(text)) open.pop();
    }
  }
  return branches;
}

/**
 * The innermost open block whose current branch only old targets compile:
 * an old-only `#if`, an old-only `#elif`, or the `#else` of an `#if` on one
 * current target with no `#elif` between them.
 * @example a stack [#if NETFRAMEWORK, #if DEBUG] gives "#if NETFRAMEWORK"
 */
function innermostOldOnly(open: readonly OpenBlock[]): string | null {
  for (const { opening, branch, hasElif } of [...open].reverse()) {
    if (branch === null && oldOnlyCondition.test(opening)) return opening;
    if (branch !== null && preprocessor.elifLine.test(branch) && oldOnlyCondition.test(branch))
      return branch;
    if (
      branch !== null &&
      preprocessor.elseLine.test(branch) &&
      !hasElif &&
      currentPlatformIf.test(opening)
    )
      return `#else of ${opening}`;
  }
  return null;
}

/**
 * The `#if` line an `#else` at `index` closes, or null when it opened above the
 * hunk. Walks back through the same version of the file as the `#else`: an
 * added line through context and added lines, a removed one through context
 * and removed lines. Nested `#if ... #endif` blocks on the way are skipped.
 * @example lines "#if NET8_0_OR_GREATER", "Fast();", "#else" give "#if NET8_0_OR_GREATER" for the third line
 */
function openingIf(lines: Hunk["lines"], index: number): string | null {
  const version = lines[index].kind;
  let depth = 0;
  for (let i = index - 1; i >= 0; i -= 1) {
    const { kind, text } = lines[i];
    if (kind !== "context" && kind !== version) continue;
    if (preprocessor.endifLine.test(text)) depth += 1;
    else if (preprocessor.ifLine.test(text)) {
      if (depth === 0) return text.trim();
      depth -= 1;
    }
  }
  return null;
}

/**
 * Guarded when a test project for the touched code builds an old target
 * unconditionally; partly when it does so only under a condition (Windows
 * only, say), which a CI machine may never meet; unguarded otherwise.
 */
async function guardByTestTargets(sourceProjects: string[], tree: BaseTree): Promise<Guard> {
  const csprojs = (await tree.listFiles("tests")).filter((path) =>
    sourceProjects.some((project) => testProjectPattern(project).test(path)),
  );
  const projects = await Promise.all(csprojs.map((csproj) => projectTargets(csproj, tree)));
  const oldTargets = projects.flatMap(({ targets }) =>
    targets.filter((target) => legacyTargetFramework.test(target.framework)),
  );
  const evidence =
    projects.length > 0
      ? // A middle dot, not a comma: each project's own framework list is already comma-separated.
        projects.map(describeTargets).join(" · ")
      : `no test project under tests/ matches ${sourceProjects.join(", ")}`;
  const files = csprojs.slice(0, maxListedFiles);

  if (oldTargets.some((target) => !target.isConditional))
    return { status: "guarded", evidence, files };
  if (oldTargets.length > 0) {
    return {
      status: "partly",
      evidence: `a test project targets an old platform only under a condition: ${evidence}`,
      files,
    };
  }
  return {
    status: "unguarded",
    evidence: `no test runs it on netstandard or .NET Framework: ${evidence}`,
    files,
  };
}

/**
 * A test project's csproj for a source project: the folder is `<project>.<Name>Tests`
 * with no further dot, so `MessagePack` claims `tests/MessagePack.Tests` but not
 * `tests/MessagePack.SourceGenerator.Tests`, which belongs to the generator.
 * @example for "MessagePack.SourceGenerator", "tests/MessagePack.SourceGenerator.ExecutionTests/X.csproj" matches
 */
function testProjectPattern(project: string): RegExp {
  const escaped = project.replace(/[.]/g, "\\.");
  return new RegExp(`^tests/${escaped}\\.\\w*Tests/[^/]+\\.csproj$`);
}

/** One target a test project builds for. */
interface Target {
  framework: string;
  /** Under a Condition, e.g. Windows only: a machine that doesn't meet it never runs it. */
  isConditional: boolean;
}

/** A test project's targets, and the Directory.Build.props they came from when the csproj sets none. */
interface ProjectTargets {
  csproj: string;
  targets: Target[];
  inheritedFrom: string | null;
}

/**
 * The targets a test project builds. A csproj that sets none gets them from
 * the nearest Directory.Build.props above it that sets targets. MSBuild
 * imports only the nearest one, which may import its parent; taking the nearest
 * that sets targets assumes it does. Without this, a test project
 * that does run net472 would read as unguarded.
 * @example "tests/A.Tests/A.csproj" with no targets, and tests/Directory.Build.props setting net8.0;net472, gives those two, inherited from tests/Directory.Build.props
 */
async function projectTargets(csproj: string, tree: BaseTree): Promise<ProjectTargets> {
  const own = parseTargets((await tree.readFile(csproj)) ?? "");
  if (own.length > 0) return { csproj, targets: own, inheritedFrom: null };
  const folders = csproj.split("/").slice(0, -1);
  for (let depth = folders.length; depth >= 0; depth -= 1) {
    const props = [...folders.slice(0, depth), "Directory.Build.props"].join("/");
    const targets = parseTargets((await tree.readFile(props)) ?? "");
    if (targets.length > 0) return { csproj, targets, inheritedFrom: props };
  }
  return { csproj, targets: [], inheritedFrom: null };
}

/**
 * Targets a csproj builds for. Properties that are not a plain framework name
 * (`$(TargetFrameworks)`) and XML comments are skipped: a commented-out
 * net472 is no evidence that anything runs on .NET Framework.
 * @example `<TargetFrameworks Condition="...Windows...">net472</TargetFrameworks>` gives [{ framework: "net472", isConditional: true }]
 */
export function parseTargets(csproj: string): Target[] {
  const withoutComments = csproj.replace(/<!--[\s\S]*?-->/g, "");
  const groups = withoutComments.matchAll(/<PropertyGroup([^>]*)>([\s\S]*?)<\/PropertyGroup>/g);
  return [...groups].flatMap(([, groupAttributes, body]) =>
    [...body.matchAll(/<TargetFrameworks?([^>]*)>([^<]*)</g)].flatMap(([, attributes, value]) =>
      value
        .split(";")
        .map((framework) => framework.trim())
        .filter((framework) => /^net/i.test(framework))
        .map((framework) => ({
          framework,
          isConditional: /Condition=/.test(groupAttributes) || /Condition=/.test(attributes),
        })),
    ),
  );
}

/**
 * The evidence line for one test project.
 * @example "tests/MessagePack.SourceGenerator.Tests targets net8.0"
 * @example "tests/MessagePack.Tests targets net8.0, net472 (from tests/Directory.Build.props)"
 */
function describeTargets({ csproj, targets, inheritedFrom }: ProjectTargets): string {
  const folder = csproj.split("/").slice(0, 2).join("/");
  const names = targets.map(
    (target) => target.framework + (target.isConditional ? " (conditional)" : ""),
  );
  const source = inheritedFrom ? ` (from ${inheritedFrom})` : "";
  return `${folder} targets ${names.join(", ") || "no plain framework"}${source}`;
}
