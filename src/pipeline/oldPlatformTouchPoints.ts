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
  legacyTargetFramework,
  maintainersOwner,
  maxListedFiles,
  oldPlatformDirective,
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
  // The first directive stands for the hunk: one hunk is one sighting, and a hunk
  // that changes several `#if` lines still asks the same question of the owner.
  const directive = hunk.lines
    .filter((line) => line.kind !== "context" && oldPlatformDirective.test(line.text))
    .map((line) => line.text.trim())[0];
  if (!project || !directive) return [];
  return [
    { detail: directive, owner: maintainersOwner.platform, hunkId: hunk.id, subject: project },
  ];
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
