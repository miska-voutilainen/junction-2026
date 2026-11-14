/**
 * Legacy guard, touch points: every place a change reaches what old systems
 * rely on, beyond the zones in legacy.ts. Path ownership (a CODEOWNERS file)
 * says who reviews a path; a touch point also says why the touch matters and
 * what evidence covers it (its guard), and notices what a path rule can't,
 * such as no test running an old target. This file holds what counts as each
 * touch kind; src/pipeline/legacyTouchPoints.ts applies it, with git and text
 * rules and no model. Our example for this repository; Tieto writes its own.
 * Spec section 5, Policy.
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

/** Most files listed as evidence on one touch point, so a card stays readable. */
export const maxListedFiles = 5;

// --- Legacy code: a reach into a zone by name ---

/**
 * Names every type has, and C# keywords that look like calls; neither is a reach
 * into a legacy zone. Run on the recorded diffs, a first version of the detector
 * found only these false positives. `Write` stays out on purpose: it is the
 * writer's own method (`this.Write` is skipped by the receiver rule instead).
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

// --- Old platform: code only old targets compile, and whether a test runs it ---

/**
 * A preprocessor line that only some old targets compile: one naming an old
 * target, or one negating a current one (`!NET6_0_OR_GREATER` is code only
 * .NET Framework and netstandard build). The `#else` of `#if NET8_0_OR_GREATER`
 * is old-only too; `currentPlatformIf` below finds those.
 * @example "#if !NETSTANDARD2_0 && !NETFRAMEWORK" and "#if !NET6_0_OR_GREATER" match; "#if DEBUG" and "#if NET8_0_OR_GREATER" do not.
 */
export const oldPlatformDirective =
  /^\s*#\s*(?:if|elif)\b.*(?:\b(?:NETFRAMEWORK|NETSTANDARD\w*|NET[34]\w*|UNITY\w*)\b|!\s*(?:NET\d+_\d+\w*|NETCOREAPP\w*)\b)/;

/**
 * An `#if` whose whole condition is one current target, so its `#else` is
 * code only old targets compile. That holds because the fork's source projects
 * build netstandard2.0, netstandard2.1, net472 and net8.0 and nothing between.
 * A compound condition (`NET8_0_OR_GREATER || NETSTANDARD2_1`) is left out:
 * its `#else` may still build on a current target.
 * @example "#if NET8_0_OR_GREATER", "#if (NET8_0_OR_GREATER) // fast path" and "#if NETCOREAPP" match; "#if NET8_0_OR_GREATER || NETSTANDARD2_1" and "#if DEBUG" do not.
 */
export const currentPlatformIf =
  /^\s*#\s*if\s+\(?\s*(?:NET(?:[5-9]|\d{2,})_\d+\w*|NETCOREAPP\w*)\s*\)?\s*(?:\/\/.*)?$/;

/**
 * An `#if` or `#elif` whose whole condition only old targets meet: old target
 * names joined by `||`, or one negated current target. Code under it is
 * old-only, so editing it is an old-platform touch even when the directive is
 * only context. Stricter than `oldPlatformDirective`, which a changed directive
 * line meets by naming an old target anywhere: `#if !NETFRAMEWORK` mentions one
 * but guards code the current targets build, so its block is not old-only.
 * @example "#if NETFRAMEWORK", "#elif NETSTANDARD2_0 || NET472" and "#if !NET6_0_OR_GREATER" match; "#if !NETFRAMEWORK" and "#if NETFRAMEWORK && DEBUG" do not.
 */
export const oldOnlyCondition =
  /^\s*#\s*(?:if|elif)\s+(?:\(?\s*(?:NETFRAMEWORK|NETSTANDARD\w*|NET[34]\w*|UNITY\w*)\s*\)?(?:\s*\|\|\s*\(?\s*(?:NETFRAMEWORK|NETSTANDARD\w*|NET[34]\w*|UNITY\w*)\s*\)?)*|!\s*\(?\s*(?:NET(?:[5-9]|\d{2,})_\d+\w*|NETCOREAPP\w*)\s*\)?)\s*(?:\/\/.*)?$/;

/**
 * The directive lines the block walk reads. `ifLine` does not match `#elif`, so
 * a walk back from an `#else` passes any `#elif` on its way to the opening `#if`.
 * @example "#else", "#elif DEBUG", "#if DEBUG" and "#endif" each match only their own pattern.
 */
export const preprocessor = {
  elseLine: /^\s*#\s*else\b/,
  elifLine: /^\s*#\s*elif\b/,
  ifLine: /^\s*#\s*if\b/,
  endifLine: /^\s*#\s*endif\b/,
};

/**
 * A test project target that runs old code: .NET Framework 4.x or netstandard.
 * @example "net472" and "netstandard2.0" match; "net8.0" does not.
 */
export const legacyTargetFramework = /^(?:net4\d+|netstandard\d.*)$/i;

// --- Consumer contract: what consumers compile against or depend on ---

/** Paths of the public surface consumers compile against; a change here reaches every consumer. */
export const consumerContractGlobs = [
  "src/MessagePack.Annotations/**",
  "**/PublicAPI.*.txt",
  "src/MessagePack.SourceGenerator/Analyzers/**",
];

/**
 * A declaration consumers compile against: a public or protected type or member.
 * Read left to right: the access modifier, any other modifiers (`static`,
 * `sealed`...), then either a type keyword (`class`, `record`...) or a member,
 * written as a return type, a name, optional generic parameters, and the `(`,
 * `{`, `=>`, `=` or `;` that starts its body. Anchored at the line start, so a
 * comment that mentions `public` does not match.
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

/**
 * What tells consumers about a contract change; any of these in the same change
 * guards it. The root README is the library's user guide.
 */
export const consumerNoteGlobs = [
  "**/AnalyzerReleases.*.md",
  "doc/**",
  "**/CHANGELOG*",
  "README.md",
];

// --- Build: inputs that change what ships, with no guard a rule can check ---

/**
 * Build inputs whose effect no test shows: src/ and the root, which the shipped
 * packages build from. tests/, benchmark/ and sandbox/ have their own
 * Directory.Build files and ship nothing.
 */
export const buildGlobs = [
  "src/**/*.csproj",
  "src/**/*.props",
  "src/**/*.targets",
  "Directory.Build.*",
  "Directory.Packages.props",
  "global.json",
];
