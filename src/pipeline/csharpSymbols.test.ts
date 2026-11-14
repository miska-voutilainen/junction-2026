import { describe, expect, it } from "vitest";
import type { Review } from "../contracts";
import { addedCalls, changedDeclarations, declaredName } from "./csharpSymbols";

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

describe("C# hunk readers", () => {
  it("names the type and method a declaration adds, not a field", () => {
    const lines = hunk("h", "a.cs", [
      ["add", "public static Foo<T, U>? Bar<T>(int a)"],
      ["add", "internal sealed class Baz"],
      ["add", "private int writer;"],
      ["context", "public void Skipped()"],
    ]);
    expect(changedDeclarations(lines)).toEqual(["Bar", "Baz"]);
  });

  it("skips comments, declarations, object creation and this. calls", () => {
    const lines = hunk("h", "a.cs", [
      ["add", "// Old(1);"],
      ["add", "public void Decl(int a)"],
      ["add", "var x = new Thing(); this.Own(); Real(1);"],
    ]);
    expect(addedCalls(lines)).toEqual(["Real"]);
  });

  it("reads no call from strings, template output or block comments", () => {
    const lines = hunk("h", "Transforms/FormatterTemplate.cs", [
      ["add", 'this.Write("            writer.WriteArrayHeader(");'],
      ["add", 'throw new InvalidOperationException("call WriteNil() first");'],
      ["add", "/* writer.WriteArrayHeader(2) used to go here */ Kept(1);"],
      ["add", " * then writer.WriteArrayHeader(count) is written"],
      ["add", 'var path = @"C:\\Old("; Real(2); // and Trailing()'],
    ]);
    expect(addedCalls(lines)).toEqual(["Kept", "Real"]);
  });

  it("reads no declaration from a comment", () => {
    const lines = hunk("h", "a.cs", [
      ["add", "// public void Serialize(ref MessagePackWriter writer) is the shape callers use"],
      ["del", "/// public static int Helper(int a)"],
    ]);
    expect(changedDeclarations(lines)).toEqual([]);
  });
});

describe("declaredName", () => {
  it("names a type or method and ignores fields and constructors", () => {
    expect(declaredName("internal sealed class Baz")).toBe("Baz");
    expect(declaredName("public static Foo<T>? Bar<T>(int a)")).toBe("Bar");
    expect(declaredName("private int writer;")).toBeNull();
    expect(declaredName("public Baz(int a)")).toBeNull();
  });

  it("finds no declaration in a comment or a string", () => {
    expect(declaredName("// public void Serialize(int a)")).toBeNull();
    expect(declaredName('this.Write("public void Serialize(");')).toBeNull();
  });
});
