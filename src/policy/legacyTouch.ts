/**
 * Legacy guard, touch points: every place a change reaches what old systems
 * rely on, beyond the zones in legacy.ts. CODEOWNERS-style path ownership says
 * who reviews a path; a touch point also says why the touch matters and what
 * evidence covers it (its guard), and notices what path rules can't, such as no
 * test running a legacy target. Git plus path and text rules, no model. Our
 * example for this repository; Tieto writes its own. Spec section 5, Policy.
 */
import type { LegacyTouchKind } from "../contracts";

/** UI and reason labels for each touch kind. */
export const legacyTouchKindLabel: Record<LegacyTouchKind, string> = {
  "legacy-code": "Legacy code",
  "old-platform": "Old platform",
  "consumer-contract": "Consumer contract",
  build: "Build",
};

/** Who decides a touch of the old platforms, the public contract and the build. */
export const maintainersOwner = {
  platform: "platform owner (the maintainers)",
  api: "API owner (the maintainers)",
  build: "build owner (the maintainers)",
};

/**
 * A preprocessor line that only some old targets compile.
 * @example "#if !NETSTANDARD2_0 && !NETFRAMEWORK" matches; "#if DEBUG" does not.
 */
export const oldPlatformDirective =
  /^\s*#\s*(?:if|elif)\b.*\b(?:NETFRAMEWORK|NETSTANDARD\w*|NET[34]\w*|UNITY\w*)\b/;

/**
 * A test project target that runs old code: .NET Framework 4.x or netstandard.
 * @example "net472" and "netstandard2.0" match; "net8.0" does not.
 */
export const legacyTargetFramework = /^(?:net4\d+|netstandard\d.*)$/i;

/**
 * A declaration consumers compile against: a public or protected type or member.
 * Anchored at the line start so a comment that mentions `public` does not match.
 * @example "    public static int Foo(" and "public sealed class Bar" match; "private int Foo(" and "// public API" do not.
 */
export const publicSurfaceLine =
  /^\s*(?:public|protected)\s+(?:(?:static|virtual|override|abstract|sealed|async|partial|readonly|unsafe|new|extern)\s+)*(?:(?:class|struct|interface|enum|record|delegate)\b|[\w.]+(?:<[^>]*>)?(?:\[\])*\??\s+\w+\s*(?:<[^>]*>)?\s*(?:\(|\{|=>|=|;))/;

/**
 * A serialization attribute. A changed `[Key]` index makes readers built against
 * the old index decode the same bytes into the wrong field, with no compile error.
 * @example "[Key(3)]" and "[MessagePackObject(true)]" match; "[Obsolete]" does not.
 */
export const wireAttributeLine =
  /\[(?:Key\(|MessagePackObject\b|Union\(|IgnoreMember\b|SerializationConstructor\b)/;

/**
 * A diagnostic id string. Consumers suppress and document analyzer diagnostics by id.
 * @example 'DiagnosticId = "MsgPack019"' matches; "MsgPackWriter" does not.
 */
export const diagnosticIdLiteral = /"MsgPack\d{3}"/;

/**
 * The source generator ships as an analyzer: consumers load it but never compile
 * against its types, so `public` and `[Key]` there are not consumer surface.
 * Its diagnostic ids still are: consumers suppress and document them.
 */
export const analyzerOnlyGlob = "src/MessagePack.SourceGenerator/**";

/**
 * A comment line: `//`, `///` (XML docs), `/*` or a continuation `*`. Docs that
 * say "public" or `[Key]` describe a contract; they do not change it.
 * @example "/// every public property" and "* [Key(0)]" match; "public int A;" does not.
 */
export const commentLine = /^\s*(?:\/\/|\/\*|\*)/;

/** Contract shapes a changed line can have, named as the touch point's detail lists them. */
export const contractShapes: ReadonlyArray<{
  label: string;
  pattern: RegExp;
  /** False for shapes that mean nothing inside the analyzer-only source generator. */
  appliesInAnalyzer: boolean;
}> = [
  { label: "public surface", pattern: publicSurfaceLine, appliesInAnalyzer: false },
  { label: "wire attributes", pattern: wireAttributeLine, appliesInAnalyzer: false },
  { label: "diagnostic ids", pattern: diagnosticIdLiteral, appliesInAnalyzer: true },
];

/** Paths of the public surface consumers compile against; a change here reaches every consumer. */
export const consumerContractGlobs = [
  "src/MessagePack.Annotations/**",
  "**/PublicAPI.*.txt",
  "src/MessagePack.SourceGenerator/Analyzers/**",
];

/** What tells consumers about a contract change; any of these in the same change guards it. */
export const consumerNoteGlobs = ["**/AnalyzerReleases.*.md", "doc/**", "**/CHANGELOG*"];

/** Build inputs whose effect no test shows; tests/** is excluded on purpose. */
export const buildGlobs = [
  "src/**/*.csproj",
  "src/**/*.props",
  "src/**/*.targets",
  "**/Directory.Build.*",
  "Directory.Packages.props",
  "global.json",
];

/**
 * Names every type has, and C# keywords that look like calls; neither is a reach
 * into a legacy zone. The first prototype on the recorded diffs produced only
 * these false positives. `Write` stays out on purpose: it is the writer's own
 * method (`this.Write` is skipped by the receiver rule instead).
 */
export const ignoredSymbolNames = new Set([
  "Equals",
  "ToString",
  "GetHashCode",
  "GetType",
  "Dispose",
  "if",
  "for",
  "foreach",
  "while",
  "switch",
  "catch",
  "using",
  "lock",
  "return",
  "nameof",
  "typeof",
  "sizeof",
  "checked",
]);

/** Most files listed as evidence on one touch point, so a card stays readable. */
export const maxListedFiles = 5;
