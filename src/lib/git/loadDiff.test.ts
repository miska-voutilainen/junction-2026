import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseUnifiedDiff } from "./loadDiff";

const smallDiff = readFileSync(join(__dirname, "fixtures", "small.diff"), "utf8");

describe("parseUnifiedDiff on a small fixture", () => {
  const { files, hunks } = parseUnifiedDiff(smallDiff);

  it("lists files in diff order with kind and area from the policy", () => {
    expect(files.map(({ path, kind, area }) => ({ path, kind, area }))).toEqual([
      { path: "src/MessagePack/Reader.cs", kind: "source", area: "security" },
      { path: "src/MessagePack.SourceGenerator/AnalyzerReleases.Unshipped.md", kind: "source", area: "analyzer" },
      { path: "doc/analyzers/MsgPack004.md", kind: "docs", area: "analyzer" },
      { path: "tests/Foo.Tests/FooTests.cs", kind: "test", area: null },
      { path: "tests/Foo.Tests/Resources/blob.bin", kind: "generated", area: null },
    ]);
  });

  it("numbers hunks h1... across files in diff order and links them from their file", () => {
    expect(hunks.map((hunk) => hunk.id)).toEqual(["h1", "h2", "h3", "h4", "h5"]);
    expect(files.map((file) => file.hunkIds)).toEqual([["h1", "h2"], ["h3"], ["h4"], ["h5"], []]);
    for (const file of files) {
      for (const id of file.hunkIds) expect(hunks.find((hunk) => hunk.id === id)?.file).toBe(file.path);
    }
  });

  it("counts added and removed lines per file, using the old path for a deletion", () => {
    expect(files.map(({ added, removed }) => [added, removed])).toEqual([[1, 1], [1, 0], [0, 2], [2, 0], [0, 0]]);
  });

  it("keeps the header without the section name, and the line ranges", () => {
    expect(hunks[0]).toMatchObject({ header: "@@ -10,6 +10,7 @@", oldStart: 10, oldLines: 6, newStart: 10, newLines: 7 });
  });

  it("numbers lines on both sides and strips the diff prefix", () => {
    const lines = hunks[1]!.lines;
    expect(lines.find((line) => line.kind === "del")).toEqual({ kind: "del", oldLine: 43, newLine: null, text: "        y();" });
    expect(lines[0]).toEqual({ kind: "context", oldLine: 40, newLine: 41, text: "    void M()" });
    expect(hunks[0]!.lines.find((line) => line.kind === "add")).toMatchObject({ oldLine: null, newLine: 13, text: "    int c;" });
  });

  it("drops the no-newline marker instead of reading it as a line", () => {
    expect(hunks[3]!.lines).toHaveLength(2);
  });
});
