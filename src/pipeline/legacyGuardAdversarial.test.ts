/**
 * Inputs chosen to make the legacy guard miss a touch (dangerous: the owner
 * never reads it) or invent one (costs reviewer trust). Each `it` is named for
 * its input. A case the code gets wrong is marked `it.fails` and names the
 * handoff issue to the engine lane, which owns the code.
 */
import { describe, expect, it } from "vitest";
import type { Review } from "../contracts";
import { parseUnifiedDiff } from "../lib/git/loadDiff";
import { addedCalls, changedDeclarations } from "./csharpSymbols";
import { fakeTree, find, hunk } from "./legacyGuardFixtures";
import { parseTargets } from "./oldPlatformTouchPoints";

const generator = "src/MessagePack.SourceGenerator/Gen.cs";
const writerFile = "src/MessagePack/MessagePackWriter.cs";
const sourceTests = (targets: string) => ({
  "tests/MessagePack.SourceGenerator.Tests/X.csproj": `<Project>${targets}</Project>`,
});

describe("old-platform directives in a hunk", () => {
  const directiveHunk = (...lines: Array<["add" | "del" | "context", string]>) =>
    hunk("h1", generator, lines);

  // Bug: #247.
  it.fails(
    "a #if NETFRAMEWORK that is only context, above an added line, is still a touch",
    async () => {
      const points = await find(
        [directiveHunk(["context", "#if NETFRAMEWORK"], ["add", "LegacyOnly();"])],
        fakeTree(),
      );
      expect(points.map((point) => point.kind)).toEqual(["old-platform"]);
    },
  );

  it("an added #if with CRLF endings keeps its directive text without the carriage return", async () => {
    const [point] = await find([directiveHunk(["add", "#if NETFRAMEWORK\r"])], fakeTree());
    expect(point.detail).toBe("#if NETFRAMEWORK");
  });

  it("a changed #if inside a string literal adds no touch", async () => {
    const points = await find([directiveHunk(["add", 'var s = "#if NETFRAMEWORK";'])], fakeTree());
    expect(points).toEqual([]);
  });

  it("a hunk with a directive outside src/ adds no touch: tests and benchmarks ship nothing", async () => {
    const inTests = hunk("h2", "tests/Foo/FooTests.cs", [["add", "#if NETFRAMEWORK"]]);
    expect(await find([inTests], fakeTree())).toEqual([]);
  });
});

describe("test project targets", () => {
  const oldOnly = hunk("h1", generator, [["add", "#if NETFRAMEWORK"]]);
  const guardFor = async (targets: string) =>
    (await find([oldOnly], fakeTree({ files: sourceTests(targets) })))[0].guard.status;

  it("reads <TargetFrameworks> with spaces and a trailing ; as guarded", async () => {
    const group =
      "<PropertyGroup><TargetFrameworks> net8.0 ; net472 ;</TargetFrameworks></PropertyGroup>";
    expect(await guardFor(group)).toBe("guarded");
  });

  it("does not guess at a $(TargetFrameworks) property: unguarded, not guarded", async () => {
    const group =
      "<PropertyGroup><TargetFrameworks>$(TestTargets)</TargetFrameworks></PropertyGroup>";
    expect(await guardFor(group)).toBe("unguarded");
  });

  it("calls a net472 target under a Windows-only Condition partly guarded", async () => {
    const group = `<PropertyGroup Condition="'$(OS)' == 'Windows_NT'"><TargetFramework>net472</TargetFramework></PropertyGroup>`;
    expect(await guardFor(group)).toBe("partly");
  });

  it("reads a netstandard2.0 target as an old platform, not as current .NET", async () => {
    const group =
      "<PropertyGroup><TargetFramework>netstandard2.0</TargetFramework></PropertyGroup>";
    expect(await guardFor(group)).toBe("guarded");
  });

  // Bug: #248.
  it.fails("does not count a net472 target inside an XML comment as guarded", async () => {
    const group =
      "<!-- <PropertyGroup><TargetFrameworks>net8.0;net472</TargetFrameworks></PropertyGroup> -->" +
      "<PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup>";
    expect(await guardFor(group)).toBe("unguarded");
  });

  // Bug: #249.
  it.fails("reads targets a Directory.Build.props sets for every test project", async () => {
    const tree = fakeTree({
      files: {
        ...sourceTests("<PropertyGroup><OutputType>Library</OutputType></PropertyGroup>"),
        "tests/Directory.Build.props":
          "<Project><PropertyGroup><TargetFrameworks>net8.0;net472</TargetFrameworks></PropertyGroup></Project>",
      },
    });
    const [point] = await find([oldOnly], tree);
    expect(point.guard.status).toBe("guarded");
  });

  it("parseTargets skips a target-less csproj", () => {
    expect(parseTargets("<Project><PropertyGroup /></Project>")).toEqual([]);
  });
});

describe("C# symbols", () => {
  const added = (text: string) => hunk("h", "src/MessagePack/Other.cs", [["add", text]]);

  it("reads a zone type name inside a string, a comment and nameof() as no call", () => {
    const lines = [
      'var text = "DynamicObjectResolver.Instance()";',
      "// DynamicObjectResolver.Instance();",
      "var name = nameof(DynamicObjectResolver);",
      'var path = @"C:\\x\\DynamicObjectResolver.Create(";',
    ];
    expect(lines.flatMap((line) => addedCalls(added(line)))).toEqual([]);
  });

  // Bug: #251.
  it.fails("finds a call to a generic method: writer.WriteExt<T>(x)", () => {
    expect(addedCalls(added("writer.WriteExt<T>(x);"))).toEqual(["WriteExt"]);
  });

  it("finds a call written with global:: and a namespace", () => {
    expect(addedCalls(added("global::MessagePack.MessagePackSerializer.Serialize(x);"))).toEqual([
      "Serialize",
    ]);
  });

  it("finds a call to an extension method like any other call", () => {
    expect(addedCalls(added("reader.ReadExtensionPayload();"))).toEqual(["ReadExtensionPayload"]);
  });

  it("finds a declaration with a generic return type", () => {
    expect(changedDeclarations(added("public static T Resolve<T>(int a)"))).toEqual(["Resolve"]);
  });

  // Bug: #253.
  it.fails(
    "finds a declaration whose return type nests generics: Task<Dictionary<string, int>>",
    () => {
      const line = "public async Task<Dictionary<string, int>> Load(int a)";
      expect(changedDeclarations(added(line))).toEqual(["Load"]);
    },
  );

  // Bug: #253.
  it.fails("finds a declaration that returns a tuple", () => {
    expect(changedDeclarations(added("public (int Start, int End) Bounds(int a)"))).toEqual([
      "Bounds",
    ]);
  });

  it("calls a partial type declared outside the zone a reach into the zone's type", async () => {
    const extras = hunk("h1", "src/MessagePack/MessagePackWriter.Extras.cs", [
      ["add", "public partial struct MessagePackWriter"],
    ]);
    const tree = fakeTree({ zoneMentions: { MessagePackWriter: [writerFile] } });
    const points = (await find([extras], tree)).filter((point) => point.kind === "legacy-code");
    expect(points.map((point) => point.detail)).toEqual([
      "MessagePackWriter: called from Wire format",
    ]);
  });
});

describe("consumer contract and build", () => {
  const publicApi = hunk("h1", "src/MessagePack/PublicAPI.Unshipped.txt", [
    ["add", "MessagePack.Foo.Bar() -> void"],
  ]);
  const contractOf = async (hunks: Review["hunks"], changed: string[]) =>
    (await find(hunks, fakeTree(), changed)).filter((point) => point.kind === "consumer-contract");

  it("a PublicAPI.Unshipped.txt change with a CHANGELOG change in the diff is guarded", async () => {
    const [point] = await contractOf([publicApi], [publicApi.file, "CHANGELOG.md"]);
    expect(point.guard).toMatchObject({ status: "guarded", files: ["CHANGELOG.md"] });
  });

  it("a PublicAPI.Unshipped.txt change with nothing else is unguarded", async () => {
    const [point] = await contractOf([publicApi], [publicApi.file]);
    expect(point.guard.status).toBe("unguarded");
  });

  it("a PublicAPI file at the repo root is still the public surface", async () => {
    const root = hunk("h1", "PublicAPI.Shipped.txt", [["add", "x"]]);
    expect((await contractOf([root], [root.file])).length).toBe(1);
  });

  it("Directory.Build.targets under src/ is a build touch, under tests/ it is not", async () => {
    const underSrc = hunk("h1", "src/Directory.Build.targets", [["add", "x"]]);
    const underTests = hunk("h2", "tests/Directory.Build.targets", [["add", "x"]]);
    const points = await find([underSrc, underTests], fakeTree());
    expect(points.map((point) => [point.kind, point.hunkIds])).toEqual([["build", ["h1"]]]);
  });
});

describe("diff edges", () => {
  const touchesOf = (diff: string) => find(parseUnifiedDiff(diff).hunks, fakeTree());

  it("an empty diff has no touch points", async () => {
    expect(await touchesOf("")).toEqual([]);
  });

  it("a deleted zone file is a zone touch, under its old name", async () => {
    const diff = [
      `diff --git a/${writerFile} b/${writerFile}`,
      "deleted file mode 100644",
      "index 1111111..0000000",
      `--- a/${writerFile}`,
      "+++ /dev/null",
      "@@ -1,2 +0,0 @@",
      "-struct MessagePackWriter",
      "-{}",
      "",
    ].join("\n");
    const points = await touchesOf(diff);
    expect(points.map((point) => point.detail)).toEqual([`Wire format: ${writerFile}`]);
  });

  it("a zone file moved out of the zone, as --no-renames writes it, touches the zone through the delete", async () => {
    const moved = "src/MessagePack/Moved.cs";
    const diff = [
      `diff --git a/${writerFile} b/${writerFile}`,
      "deleted file mode 100644",
      "index 1111111..0000000",
      `--- a/${writerFile}`,
      "+++ /dev/null",
      "@@ -1 +0,0 @@",
      "-struct MessagePackWriter {}",
      `diff --git a/${moved} b/${moved}`,
      "new file mode 100644",
      "index 0000000..1111111",
      "--- /dev/null",
      `+++ b/${moved}`,
      "@@ -0,0 +1 @@",
      "+struct MessagePackWriter {}",
      "",
    ].join("\n");
    const points = await touchesOf(diff);
    expect(points.map((point) => point.detail)).toContain(`Wire format: ${writerFile}`);
  });

  // Bug: #254.
  it.fails("a mode-only change to a zone file is a zone touch", async () => {
    const diff = [
      `diff --git a/${writerFile} b/${writerFile}`,
      "old mode 100644",
      "new mode 100755",
      "",
    ].join("\n");
    const points = await touchesOf(diff);
    expect(points.map((point) => point.kind)).toEqual(["legacy-code"]);
  });

  // Bug: #254.
  it.fails("a binary file in a zone is a zone touch", async () => {
    const path = "src/MessagePack.UnityClient/Assets/Plugin.dll";
    const diff = [
      `diff --git a/${path} b/${path}`,
      "index 1111111..2222222 100644",
      `Binary files a/${path} and b/${path} differ`,
      "",
    ].join("\n");
    const points = await touchesOf(diff);
    expect(points.map((point) => point.kind)).toEqual(["legacy-code"]);
  });

  it("a hunk header with no context lines still reads its added directive", async () => {
    const diff = [
      `diff --git a/${generator} b/${generator}`,
      "index 1111111..2222222 100644",
      `--- a/${generator}`,
      `+++ b/${generator}`,
      "@@ -0,0 +1 @@",
      "+#if NETFRAMEWORK",
      "",
    ].join("\n");
    const points = await touchesOf(diff);
    expect(points.map((point) => point.kind)).toEqual(["old-platform"]);
  });
});
