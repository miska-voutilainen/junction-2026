import { describe, expect, it } from "vitest";
import { areaChecklists } from "./areaChecklists";
import { classifyFile } from "./areas";

describe("classifyFile", () => {
  it.each([
    ["tests/MessagePack.Tests/Resources/x.bin", "generated", null],
    ["tests/Foo/Bar.verified.txt", "generated", null],
    ["tests/Foo/BarTests.cs", "test", null],
    ["src/MessagePack.SourceGenerator/AnalyzerReleases.Unshipped.md", "source", "analyzer"],
    ["doc/analyzers/MsgPack004.md", "docs", "analyzer"],
    ["README.md", "docs", null],
    ["src/MessagePack.SourceGenerator/Analyzers/Foo.cs", "source", "analyzer"],
    ["src/MessagePack.SourceGenerator/Transforms/Foo.cs", "source", "security"],
    ["src/MessagePack/Resolvers/Foo.cs", "source", "security"],
    ["src/MessagePack.SourceGenerator/CodeAnalysis/TypeCollector.cs", "source", "generator"],
    ["src/MessagePack.Annotations/KeyAttribute.cs", "source", "generator"],
    ["sandbox/Program.cs", "source", null],
  ] as const)("%s is %s, area %s", (path, kind, area) => {
    expect(classifyFile(path)).toEqual({ kind, area });
  });
});

describe("areaChecklists", () => {
  it("has six to ten checks for each of the four areas", () => {
    expect(Object.keys(areaChecklists).sort()).toEqual([
      "analyzer",
      "generator",
      "performance",
      "security",
    ]);
    for (const items of Object.values(areaChecklists)) {
      expect(items.length).toBeGreaterThanOrEqual(6);
      expect(items.length).toBeLessThanOrEqual(10);
    }
  });
});
