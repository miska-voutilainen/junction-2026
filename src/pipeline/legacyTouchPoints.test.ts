import { describe, expect, it } from "vitest";
import type { Review } from "../contracts";
import { legacyTouchRefusalsFor } from "./checkFindings";
import type { BaseTree } from "../lib/git/baseTree";
import { findLegacyTouchPoints, parseTargets } from "./legacyTouchPoints";

type Hunk = Review["hunks"][number];

function hunk(id: string, file: string, lines: Array<["add" | "del" | "context", string]>): Hunk {
  return {
    id,
    file,
    header: "@@ -1,1 +1,1 @@",
    oldStart: 1,
    oldLines: 1,
    newStart: 1,
    newLines: 1,
    lines: lines.map(([kind, text]) => ({ kind, text, oldLine: null, newLine: null })),
  };
}

function fileOf(path: string): Review["files"][number] {
  return { path, kind: "source", area: null, added: 1, removed: 0, hunkIds: [] };
}

/**
 * A base commit as the detectors see it: `mentions` are test files per word,
 * `zoneMentions` zone files per word, `zoneSymbols` what the zones declare, and
 * `files` the files (csproj) at base. Nothing is read from git.
 */
function fakeTree(
  parts: {
    mentions?: Record<string, string[]>;
    zoneMentions?: Record<string, string[]>;
    zoneSymbols?: Record<string, string>;
    files?: Record<string, string>;
  } = {},
): BaseTree {
  const files = parts.files ?? {};
  return {
    filesMentioning: async (word, pathspecs) =>
      (pathspecs[0] === "tests" ? parts.mentions?.[word] : parts.zoneMentions?.[word]) ?? [],
    accessModifierLines: async () =>
      Object.entries(parts.zoneSymbols ?? {}).map(([name, path]) => ({
        path,
        text: `public void ${name}(int a)`,
      })),
    readFile: async (path) => files[path] ?? null,
    listFiles: async () => Object.keys(files),
  };
}

const find = (hunks: Hunk[], tree: BaseTree, changedPaths: string[] = []) =>
  findLegacyTouchPoints({ repoDir: "", baseSha: "", files: changedPaths.map(fileOf), hunks }, tree);

describe("legacy-code", () => {
  const writerHunk = hunk("h1", "src/MessagePack/MessagePackWriter.cs", [["add", "x = 1;"]]);

  it("guards a zone hunk by a test at base that names the file's type", async () => {
    const tree = fakeTree({
      mentions: { MessagePackWriter: ["tests/MessagePack.Tests/WriterTests.cs"] },
    });
    const [point] = await find([writerHunk], tree);
    expect(point).toMatchObject({
      kind: "legacy-code",
      detail: "Wire format: src/MessagePack/MessagePackWriter.cs",
      guard: { status: "guarded", files: ["tests/MessagePack.Tests/WriterTests.cs"] },
    });
  });

  it("leaves a zone hunk unguarded when no test names the type", async () => {
    const [point] = await find([writerHunk], fakeTree());
    expect(point.guard.status).toBe("unguarded");
  });

  it("finds a call into a zone symbol, but not on this. or a BCL name", async () => {
    const calls = hunk("h2", "src/MessagePack.SourceGenerator/Gen.cs", [
      ["add", "this.Write(x); writer.WriteMapHeader(2); value.ToString();"],
    ]);
    const zoneFile = "src/MessagePack/MessagePackWriter.cs";
    const tree = fakeTree({
      zoneSymbols: { Write: zoneFile, WriteMapHeader: zoneFile, ToString: zoneFile },
    });
    const points = await find([calls], tree);
    expect(points.map((point) => point.detail)).toEqual(["WriteMapHeader: calls into Wire format"]);
  });

  it("finds a declaration that zone files use, and nothing in a test file", async () => {
    const declares = hunk("h3", "src/MessagePack.SourceGenerator/Gen.cs", [
      ["del", "public static int Helper(int a)"],
    ]);
    const inTest = hunk("h4", "tests/Foo/FooTests.cs", [
      ["del", "public static int Helper(int a)"],
    ]);
    const tree = fakeTree({ zoneMentions: { Helper: ["src/MessagePack/MessagePackReader.cs"] } });
    const points = (await find([declares, inTest], tree)).filter(
      (point) => point.kind === "legacy-code",
    );
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ detail: "Helper: called from Wire format", hunkIds: ["h3"] });
  });

  it("reports nothing for a hunk outside the zones that touches nothing zone-owned", async () => {
    const other = hunk("h5", "src/MessagePack/Other.cs", [["add", "Foo();"]]);
    expect(await find([other], fakeTree())).toEqual([]);
  });
});

describe("old-platform", () => {
  const directive = "#if !NETSTANDARD2_0 && !NETFRAMEWORK";
  const template = hunk("h1", "src/MessagePack.SourceGenerator/Transforms/EnumTemplate.cs", [
    ["add", directive],
  ]);
  const testProject = (targets: string) => ({
    "tests/MessagePack.SourceGenerator.Tests/X.csproj": `<Project><PropertyGroup>${targets}</PropertyGroup></Project>`,
  });

  it("is unguarded when the test projects only target current .NET, and says which", async () => {
    const [point] = await find(
      [template],
      fakeTree({ files: testProject("<TargetFramework>net8.0</TargetFramework>") }),
    );
    expect(point.guard.status).toBe("unguarded");
    expect(point.guard.evidence).toContain(
      "tests/MessagePack.SourceGenerator.Tests targets net8.0",
    );
  });

  it("is guarded by an unconditional legacy target and partly by a conditional one", async () => {
    const always = fakeTree({
      files: testProject("<TargetFrameworks>net8.0;net472</TargetFrameworks>"),
    });
    expect((await find([template], always))[0].guard.status).toBe("guarded");
    const windowsOnly = fakeTree({
      files: testProject(
        `<TargetFrameworks Condition="'$(OS)'=='Windows_NT'">net472</TargetFrameworks>`,
      ),
    });
    expect((await find([template], windowsOnly))[0].guard.status).toBe("partly");
  });

  it("does not give a source project the test projects of a longer-named one", async () => {
    const generatorTests = fakeTree({
      files: testProject("<TargetFramework>net472</TargetFramework>"),
    });
    const core = hunk("h9", "src/MessagePack/Core.cs", [["add", directive]]);
    const [point] = await find([core], generatorTests);
    expect(point.guard.status).toBe("unguarded");
    expect(point.guard.evidence).toContain("no test project under tests/ matches MessagePack");
  });

  it("groups hunks with the same directive and ignores other #if lines", async () => {
    const second = hunk("h2", "src/MessagePack.SourceGenerator/Transforms/UnionTemplate.cs", [
      ["del", directive],
    ]);
    const debug = hunk("h3", "src/MessagePack.SourceGenerator/Transforms/Other.cs", [
      ["add", "#if DEBUG"],
    ]);
    const points = await find([template, second, debug], fakeTree());
    expect(points).toHaveLength(1);
    expect(points[0].hunkIds).toEqual(["h1", "h2"]);
  });

  it("reads plain and conditional targets from a csproj", () => {
    const csproj =
      "<PropertyGroup><TargetFrameworks>$(X);net8.0</TargetFrameworks></PropertyGroup>" +
      '<PropertyGroup Condition="a"><TargetFramework>net472</TargetFramework></PropertyGroup>';
    expect(
      parseTargets(
        "<PropertyGroup><TargetFrameworks>net8.0; net472</TargetFrameworks></PropertyGroup>",
      ).map((target) => target.framework),
    ).toEqual(["net8.0", "net472"]);
    expect(parseTargets(csproj)).toEqual([
      { framework: "net8.0", isConditional: false },
      { framework: "net472", isConditional: true },
    ]);
  });
});

describe("consumer-contract and build", () => {
  const analyzer = hunk("h1", "src/MessagePack.SourceGenerator/Analyzers/Foo.cs", [["add", "x"]]);

  it("is guarded when the change also updates release notes or docs", async () => {
    const notes = [
      "src/MessagePack.SourceGenerator/AnalyzerReleases.Unshipped.md",
      "doc/analyzers/MsgPack001.md",
    ];
    const [point] = await find([analyzer], fakeTree(), notes);
    expect(point).toMatchObject({
      kind: "consumer-contract",
      owner: "API owner (the maintainers)",
      guard: { status: "guarded" },
    });
    expect(point.guard.files).toEqual(notes);
  });

  describe("contract shapes outside the contract paths", () => {
    const file = "src/MessagePack/Formatters/Thing.cs";
    const notes = ["src/MessagePack.SourceGenerator/AnalyzerReleases.Unshipped.md"];
    const touchFor = async (line: string, kind: "add" | "del" = "add") =>
      (await find([hunk("h1", file, [[kind, line]])], fakeTree(), [file])).filter(
        (point) => point.kind === "consumer-contract",
      );

    it("finds a public method added outside the globs", async () => {
      const [point] = await touchFor("    public static int Parse(string text)");
      expect(point).toMatchObject({ hunkIds: ["h1"], detail: "public surface" });
    });

    it("finds a changed [Key] index", async () => {
      const points = [...(await touchFor("[Key(3)]", "del")), ...(await touchFor("[Key(4)]"))];
      expect(points.map((point) => point.detail)).toEqual(["wire attributes", "wire attributes"]);
    });

    it("finds a diagnostic id literal", async () => {
      const [point] = await touchFor('    DiagnosticId = "MsgPack019";');
      expect(point.detail).toBe("diagnostic ids");
    });

    it("ignores a private method and a comment that mentions public", async () => {
      expect(await touchFor("    private int Parse(string text)")).toEqual([]);
      expect(await touchFor("    // public API stays as it is")).toEqual([]);
    });

    it("ignores a doc comment that mentions public and [Key]", async () => {
      expect(await touchFor("    /// every public property, <c>[Key]</c> index")).toEqual([]);
      expect(await touchFor("     * public [Key(0)]")).toEqual([]);
    });

    it("reads diagnostic ids but not public members inside the source generator", async () => {
      const generator = "src/MessagePack.SourceGenerator/CodeAnalysis/Info.cs";
      const analyzer = "src/MessagePack.SourceGenerator/Analyzers/Foo.cs";
      const record = hunk("h5", generator, [["add", "public record Info(int Id);"]]);
      const id = hunk("h6", analyzer, [["add", 'Id = "MsgPack019";']]);
      const points = await find([record, id], fakeTree(), [generator, analyzer]);
      const contract = points.filter((point) => point.kind === "consumer-contract");
      expect(contract.map((point) => point.hunkIds)).toEqual([["h6"]]);
    });

    it("ignores a public declaration in tests", async () => {
      const inTests = hunk("h2", "tests/Foo/FooTests.cs", [["add", "public void Works()"]]);
      expect(await find([inTests], fakeTree(), [])).toEqual([]);
    });

    it("stays guarded when an AnalyzerReleases note is in the change", async () => {
      const changed = hunk("h1", file, [["add", 'Id = "MsgPack019";']]);
      const [point] = await find([changed], fakeTree(), [file, ...notes]);
      expect(point.guard.status).toBe("guarded");
    });
  });

  it("is unguarded when nothing tells consumers", async () => {
    const [point] = await find([analyzer], fakeTree(), [
      "src/MessagePack.SourceGenerator/Analyzers/Foo.cs",
    ]);
    expect(point.guard.status).toBe("unguarded");
  });

  it("marks src build files owner-read and leaves tests/** alone", async () => {
    const srcBuild = hunk("h2", "src/MessagePack/MessagePack.csproj", [["add", "x"]]);
    const testBuild = hunk("h3", "tests/Foo/Foo.csproj", [["add", "x"]]);
    const points = await find([srcBuild, testBuild], fakeTree());
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({
      kind: "build",
      hunkIds: ["h2"],
      guard: { status: "owner-read" },
    });
  });
});

describe("legacyTouchRefusalsFor", () => {
  const point = {
    kind: "old-platform" as const,
    hunkIds: ["h1", "h2"],
    detail: "#if NETFRAMEWORK",
    owner: "platform owner (the maintainers)",
    guard: { status: "unguarded" as const, evidence: "no test runs it", files: [] },
  };

  it("adds one R8 rule refusal for hunks no rule refusal names yet", () => {
    const [refusal] = legacyTouchRefusalsFor(
      [point],
      [{ ruleId: "R8", source: "rule", hunkIds: ["h1"] }],
    );
    expect(refusal).toMatchObject({ ruleId: "R8", source: "rule", hunkIds: ["h2"] });
    expect(refusal.reason).toBe(
      "Old platform: #if NETFRAMEWORK (unguarded: no test runs it); the platform owner (the maintainers) decides",
    );
  });

  it("adds nothing when every hunk is already named", () => {
    const named = [{ ruleId: "R8", source: "rule" as const, hunkIds: ["h1", "h2"] }];
    expect(legacyTouchRefusalsFor([point], named)).toEqual([]);
  });

  it("skips hunks an AI R7 names for a consumer contract, but not for other kinds", () => {
    const aiR7 = [{ ruleId: "R7", source: "ai" as const, hunkIds: ["h1"] }];
    const contract = { ...point, kind: "consumer-contract" as const };
    expect(legacyTouchRefusalsFor([contract], aiR7)[0].hunkIds).toEqual(["h2"]);
    expect(legacyTouchRefusalsFor([point], aiR7)[0].hunkIds).toEqual(["h1", "h2"]);
  });
});
