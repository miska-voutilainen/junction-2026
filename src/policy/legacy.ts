/**
 * Legacy guard: code that old systems depend on. New code keeps the fast path
 * (evidence, trust ladder), but every hunk that touches a declared legacy zone
 * goes to a person, and that person is the zone's named owner. Agent-written
 * code that is fine on its own can still break a system that relies on the old
 * behaviour, and no test in the PR knows about that system. Spec section 5, Policy.
 */
import { matchesGlob } from "./globMatch";
import type { RefusalRule } from "./refusals";

/**
 * R8, raised only by code (src/pipeline/checkFindings.ts), never by the model:
 * the model doesn't know the zone map. It lives here, not in refusals.ts,
 * because refusals.ts is part of the A3 prompt (see refusalPolicy.ts).
 */
export const legacyRefusalRule: RefusalRule = {
  id: "R8",
  title: "Legacy contract: behaviour that old systems depend on",
  decider: "the zone's owner (src/policy/legacy.ts)",
};

/** A part of the codebase that deployed systems rely on, with who decides changes to it. */
export interface LegacyZone {
  /** Stable id, e.g. "wire-format". */
  id: string;
  /** Shown in reasons and refusals, e.g. "Wire format". */
  label: string;
  /** Repo-relative path globs; a file in any of them is in the zone. */
  globs: string[];
  /** The role that decides a change here; the R8 refusal names it. */
  owner: string;
  /** What old systems rely on, in one sentence. */
  contract: string;
}

/**
 * Our example zone map for Tieto's MessagePack-CSharp fork. Tieto writes its
 * own for its repositories; the first zone whose glob matches a path wins.
 */
export const legacyZones: LegacyZone[] = [
  {
    id: "dynamic-resolvers",
    label: "Reflection resolvers",
    globs: ["src/MessagePack/Resolvers/Dynamic*.cs"],
    owner: "runtime owner (the maintainers)",
    contract:
      "the reflection and IL-emit serializers that apps not yet on the source generator still run",
  },
  {
    id: "wire-format",
    label: "Wire format",
    globs: [
      "src/MessagePack/MessagePackCode.cs",
      "src/MessagePack/MessagePackReader*.cs",
      "src/MessagePack/MessagePackWriter.cs",
    ],
    owner: "runtime owner (the maintainers)",
    contract: "the bytes every deployed reader and writer agrees on",
  },
  {
    id: "unity-client",
    label: "Unity client",
    globs: ["src/MessagePack.UnityClient/**", "src/MessagePack.SourceGenerator.Unity/**"],
    owner: "Unity owner (the maintainers)",
    contract: "old Unity and IL2CPP runtimes that can't be upgraded with the library",
  },
];

/**
 * Hunks that touch legacy code (in a zone, or reaching into one from outside),
 * across all zones of one change, at or above which rule
 * R-legacy asks for a Full read instead of Focused. 5 is a judgement, not a
 * measurement: a handful of hunks is a focused read of the boundary; past that
 * the change is reworking the boundary and needs a full read.
 */
export const legacyTouchFull = 5;

/**
 * The legacy zone a repo-relative path (forward slashes) belongs to, or null.
 * @example legacyZoneOf("src/MessagePack/MessagePackWriter.cs")?.id // "wire-format"
 */
export function legacyZoneOf(path: string): LegacyZone | null {
  return legacyZones.find((zone) => zone.globs.some((glob) => matchesGlob(glob, path))) ?? null;
}
