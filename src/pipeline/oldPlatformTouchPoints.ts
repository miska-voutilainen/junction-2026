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
 * or an `#else` of an `#if` on one current target. The first stands for the
 * hunk: a hunk that changes several such lines asks the owner the same question.
 * @example a hunk with context "#if NET8_0_OR_GREATER" and an added "#else" gives "#else of #if NET8_0_OR_GREATER"
 */
function firstOldPlatformDirective(lines: Hunk["lines"]): string | null {
  for (const [index, line] of lines.entries()) {
    if (line.kind === "context") continue;
    if (oldPlatformDirective.test(line.text)) return line.text.trim();
    if (!preprocessor.elseLine.test(line.text)) continue;
    const opening = openingIf(lines, index);
    if (opening && currentPlatformIf.test(opening)) return `#else of ${opening}`;
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
  const projects = await Promise.all(
    csprojs.map(async (csproj) => ({
      csproj,
      targets: parseTargets((await tree.readFile(csproj)) ?? ""),
    })),
  );
  const oldTargets = projects.flatMap(({ targets }) =>
    targets.filter((target) => legacyTargetFramework.test(target.framework)),
  );
  const evidence =
    projects.length > 0
      ? projects.map(({ csproj, targets }) => describeTargets(csproj, targets)).join("; ")
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
 */
function describeTargets(csproj: string, targets: Target[]): string {
  const folder = csproj.split("/").slice(0, 2).join("/");
  const names = targets.map(
    (target) => target.framework + (target.isConditional ? " (conditional)" : ""),
  );
  return `${folder} targets ${names.join(", ") || "no plain framework"}`;
}
