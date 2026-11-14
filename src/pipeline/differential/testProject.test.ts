import { describe, expect, it } from "vitest";
import type { Review } from "../../contracts";
import {
  changedTestMethods,
  chooseStyleExample,
  declaresTestMethod,
  limitTestNames,
  testProjectDir,
} from "./testProject";

type ReviewFile = Review["files"][number];
type Hunk = Review["hunks"][number];

const file = (path: string, kind: ReviewFile["kind"]): ReviewFile => ({
  path,
  kind,
  area: null,
  added: 1,
  removed: 0,
  hunkIds: [],
});

describe("testProjectDir", () => {
  it("is the project folder of the first changed test file", () => {
    const files = [
      file("src/A.cs", "source"),
      file("tests/X.Tests/Resources/o.verified.cs", "generated"),
      file("tests/X.Tests/A.cs", "test"),
    ];
    expect(testProjectDir(files)).toBe("tests/X.Tests");
  });

  it("is null when the change touches no test project", () => {
    expect(testProjectDir([file("src/A.cs", "source"), file("README.md", "docs")])).toBeNull();
  });
});

describe("chooseStyleExample", () => {
  const basePaths = ["tests/X/B.cs", "tests/X/ZTests.cs", "tests/X/ATests.cs"];

  it("prefers a test file the change touches and that exists on the base", () => {
    const changed = [file("tests/X/New.cs", "test"), file("tests/X/ZTests.cs", "test")];
    expect(chooseStyleExample("tests/X", basePaths, changed)).toBe("tests/X/ZTests.cs");
  });

  it("falls back to the first *Tests.cs of the project", () => {
    expect(chooseStyleExample("tests/X", basePaths, [file("tests/X/New.cs", "test")])).toBe(
      "tests/X/ATests.cs",
    );
  });

  it("is null when the project has no test file", () => {
    expect(chooseStyleExample("tests/Y", basePaths, [])).toBeNull();
  });
});

describe("changedTestMethods", () => {
  const head = [
    "class T",
    "{",
    "    [Fact]",
    "    public void Old()",
    "    {",
    "    }",
    "    [Fact]",
    "    public async Task Changed()",
    "    {",
    "        Assert.True(true);",
    "    }",
    "    [Theory]",
    "    [InlineData(1)]",
    "    public void New(int x)",
    "    {",
    "    }",
    "}",
  ].join("\n");
  const hunk = (newLines: number[], path = "T.cs"): Hunk => ({
    id: "h1",
    file: path,
    header: "@@ -1,1 +1,1 @@",
    oldStart: 1,
    oldLines: 1,
    newStart: 1,
    newLines: 1,
    lines: newLines.map((newLine) => ({ kind: "add" as const, oldLine: null, newLine, text: "" })),
  });

  it("names a test whose body changed and a new test, not an untouched one", () => {
    expect(changedTestMethods(head, [hunk([10, 14])], "T.cs")).toEqual(["Changed", "New"]);
  });

  it("ignores hunks of other files", () => {
    expect(changedTestMethods(head, [hunk([10], "Other.cs")], "T.cs")).toEqual([]);
  });
});

describe("limitTestNames", () => {
  it("drops repeats and caps the list", () => {
    expect(limitTestNames(["A", "A", "B"])).toEqual(["A", "B"]);
    expect(limitTestNames(Array.from({ length: 100 }, (_, i) => `T${i}`))).toHaveLength(40);
  });
});

describe("declaresTestMethod", () => {
  const code = "public async Task Test_F1_Works() {}\npublic void Test_F2_Other () {}";

  it("finds void, Task and ValueTask methods by name", () => {
    expect(declaresTestMethod(code, "Test_F1_Works")).toBe(true);
    expect(declaresTestMethod(code, "Test_F2_Other")).toBe(true);
  });

  it("does not match a name that is only a prefix or a call", () => {
    expect(declaresTestMethod(code, "Test_F1")).toBe(false);
    expect(declaresTestMethod("Test_F1_Works();", "Test_F1_Works")).toBe(false);
  });
});
