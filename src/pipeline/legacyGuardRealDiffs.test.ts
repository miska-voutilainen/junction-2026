/**
 * Cases found by running the legacy guard over 28 real commits of the MessagePack
 * fork's history (idea 9): each one failed before the fix. They are about names
 * that are too common to count as evidence (a licence file, `Add`) and about
 * a restructure that put one card on every file. The fake tree stands in for git.
 * How the commits were chosen and what each case cost: docs/lessons.md, "The legacy
 * guard on 28 real commits".
 */
import { describe, expect, it } from "vitest";
import { fakeTree, find, hunk } from "./legacyGuardFixtures";

const unityPackages = "src/MessagePack.UnityClient/Assets/Packages";

describe("a non-source file in a legacy zone", () => {
  it("is not guarded by a test that happens to contain the file's name", async () => {
    // Commit eac157d0 added Unity package files; 123 test files contain the word LICENSE.
    const licence = hunk("h1", `${unityPackages}/System.Collections.Immutable.6.0.0/LICENSE.TXT`, [
      ["add", "The MIT License (MIT)"],
    ]);
    const tree = fakeTree({ mentions: { LICENSE: ["tests/MessagePack.Tests/LicenseTests.cs"] } });
    const [point] = await find([licence], tree);
    expect(point.guard.status).toBe("unguarded");
    expect(point.guard.files).toEqual([]);
  });

  it("is not guarded by a test that names the package it ships", async () => {
    // A .meta file for System.Collections.Immutable is not covered by tests that use System.
    const meta = hunk("h2", `${unityPackages}/System.Collections.Immutable.6.0.0.meta`, [
      ["add", "fileFormatVersion: 2"],
    ]);
    const tree = fakeTree({ mentions: { System: ["tests/MessagePack.Tests/AnyTests.cs"] } });
    const [point] = await find([meta], tree);
    expect(point.guard.status).toBe("unguarded");
  });

  it("makes one touch point per folder, not one per file", async () => {
    // Commit 104130e9 restructured the repository: 1156 cards, one per Unity package file.
    const hunks = [
      hunk("h1", `${unityPackages}/A.6.0.0/lib/net461/A.dll.meta`, [["add", "x"]]),
      hunk("h2", `${unityPackages}/A.6.0.0/LICENSE.TXT`, [["add", "x"]]),
      hunk("h3", `${unityPackages}/B.1.0.0/B.nuspec`, [["add", "x"]]),
      hunk("h4", "src/MessagePack.UnityClient/Assets/NuGet.config", [["add", "x"]]),
    ];
    const points = await find(hunks, fakeTree());
    expect(points.map((point) => [point.detail, point.hunkIds])).toEqual([
      [
        "Unity client: non-source files under src/MessagePack.UnityClient/Assets/Packages",
        ["h1", "h2", "h3"],
      ],
      ["Unity client: non-source files under src/MessagePack.UnityClient/Assets", ["h4"]],
    ]);
  });

  it("treats an upper-case .CS extension as source", async () => {
    const formatter = hunk("h1", "src/MessagePack.UnityClient/Assets/Scripts/Foo.CS", [
      ["add", "x = 1;"],
    ]);
    const tree = fakeTree({ mentions: { Foo: ["tests/MessagePack.Tests/FooTests.cs"] } });
    const [point] = await find([formatter], tree);
    expect(point.guard.status).toBe("guarded");
  });

  it("still names a source file in the zone and guards it by its type", async () => {
    const formatter = hunk(
      "h1",
      "src/MessagePack.UnityClient/Assets/Scripts/MessagePack/Formatters/CollectionFormatter.cs",
      [["add", "x = 1;"]],
    );
    const tree = fakeTree({
      mentions: { CollectionFormatter: ["tests/MessagePack.Tests/CollectionTests.cs"] },
    });
    const [point] = await find([formatter], tree);
    expect(point.guard.status).toBe("guarded");
  });
});

describe("a call into a zone symbol", () => {
  it("is skipped when a file outside the zones declares the same name", async () => {
    // Commit c6aed61d: `Serialize` is declared by every formatter and by the Unity
    // client's copy of the library, so the call says nothing about the Unity client.
    const calls = hunk("h1", "src/MessagePack/Formatters/ListFormatter.cs", [
      ["add", "formatter.Serialize(ref writer, value, options);"],
    ]);
    const tree = fakeTree({
      zoneSymbols: {
        Serialize: "src/MessagePack.UnityClient/Assets/Scripts/MessagePack/Formatters.cs",
      },
      outsideSymbols: { Serialize: ["src/MessagePack/Formatters/StringFormatter.cs"] },
    });
    expect(await find([calls], tree)).toEqual([]);
  });

  it("is still found in a zone that does not copy the library, though a formatter declares the name", async () => {
    // Skipping Write because some formatter also declares it would hide a real call into the wire format.
    const calls = hunk("h1", "src/MessagePack/Formatters/ListFormatter.cs", [
      ["add", "writer.Write(value);"],
    ]);
    const tree = fakeTree({
      zoneSymbols: { Write: "src/MessagePack/MessagePackWriter.cs" },
      outsideSymbols: { Write: ["src/MessagePack/Formatters/ListFormatter.cs"] },
    });
    const points = await find([calls], tree);
    expect(points.map((point) => point.detail)).toEqual(["Write: calls into Wire format"]);
  });

  it("is still found when only zone files declare the name", async () => {
    const calls = hunk("h1", "src/MessagePack/Formatters/ListFormatter.cs", [
      ["add", "writer.WriteNil();"],
    ]);
    const tree = fakeTree({ zoneSymbols: { WriteNil: "src/MessagePack/MessagePackWriter.cs" } });
    const points = await find([calls], tree);
    expect(points.map((point) => point.detail)).toEqual(["WriteNil: calls into Wire format"]);
  });
});
