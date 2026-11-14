/**
 * Areas: which part of Tieto's MessagePack-CSharp a changed file belongs to,
 * and whether it is source, test, docs or generated output. The area decides
 * which checklist the AI reviews against and which part of the trust ladder a
 * caught or missed bug counts toward. Plain path rules, no model. Spec section 5, Policy.
 */
import type { Area, FileKind } from "../contracts";
import { matchesGlob } from "./globMatch";

/** What a path is: its kind, and its review area when it has one. */
export interface FileClass {
  kind: FileKind;
  area: Area | null;
}

interface AreaRule extends FileClass {
  globs: string[];
}

/**
 * Checked in order, first match wins. The analyzer release notes come before
 * the general Markdown rule: they hold diagnostic IDs, so they are source for
 * the analyzer area, not docs.
 */
const areaRules: AreaRule[] = [
  { globs: ["tests/**/Resources/**", "**/*.verified.*"], kind: "generated", area: null },
  { globs: ["tests/**"], kind: "test", area: null },
  { globs: ["**/AnalyzerReleases.*.md"], kind: "source", area: "analyzer" },
  { globs: ["doc/analyzers/**/*.md"], kind: "docs", area: "analyzer" },
  { globs: ["**/*.md"], kind: "docs", area: null },
  { globs: ["src/MessagePack.SourceGenerator/Analyzers/**"], kind: "source", area: "analyzer" },
  // These generate or run deserialization of untrusted input.
  {
    globs: ["src/MessagePack.SourceGenerator/Transforms/**", "src/MessagePack/**"],
    kind: "source",
    area: "security",
  },
  {
    globs: ["src/MessagePack.SourceGenerator/**", "src/MessagePack.Annotations/**"],
    kind: "source",
    area: "generator",
  },
];

/**
 * Classifies a repo-relative path (forward slashes).
 *
 * @example classifyFile("src/MessagePack/Resolvers/DynamicObjectResolver.cs") // { kind: "source", area: "security" }
 */
export function classifyFile(path: string): FileClass {
  const rule = areaRules.find((candidate) =>
    candidate.globs.some((glob) => matchesGlob(glob, path)),
  );
  return rule ? { kind: rule.kind, area: rule.area } : { kind: "source", area: null };
}
