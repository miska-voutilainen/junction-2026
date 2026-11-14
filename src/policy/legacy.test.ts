import { describe, expect, it } from "vitest";
import { legacyZoneOf } from "./legacy";

describe("legacyZoneOf", () => {
  it.each([
    ["src/MessagePack/Resolvers/DynamicObjectResolver.cs", "dynamic-resolvers"],
    ["src/MessagePack/MessagePackWriter.cs", "wire-format"],
    ["src/MessagePack/MessagePackReader.Integers.cs", "wire-format"],
    ["src/MessagePack.UnityClient/Assets/Scripts/Foo.cs", "unity-client"],
  ])("puts %s in %s", (path, zoneId) => {
    expect(legacyZoneOf(path)?.id).toBe(zoneId);
  });

  it("returns null for code outside every zone", () => {
    expect(legacyZoneOf("src/MessagePack/Resolvers/StandardResolver.cs")).toBeNull();
  });
});

describe("legacyZoneOf, adversarial paths", () => {
  it("puts a new file matching Dynamic*.cs in the reflection resolvers zone", () => {
    expect(legacyZoneOf("src/MessagePack/Resolvers/DynamicNewThingResolver.cs")?.id).toBe(
      "dynamic-resolvers",
    );
  });

  it("puts both sides of a rename in the zone they belong to (the diff is generated with --no-renames, so a move is a delete plus an add)", () => {
    expect(legacyZoneOf("src/MessagePack/Resolvers/StandardResolver.cs")).toBeNull();
    expect(legacyZoneOf("src/MessagePack/Resolvers/DynamicStandardResolver.cs")?.id).toBe(
      "dynamic-resolvers",
    );
    expect(legacyZoneOf("src/MessagePack/MessagePackCode.cs")?.id).toBe("wire-format");
    expect(legacyZoneOf("src/MessagePack/MessagePackCodes.cs")).toBeNull();
  });

  it("keeps a deleted zone file in its zone: its path is the old name", () => {
    expect(legacyZoneOf("src/MessagePack/MessagePackReader.Integers.cs")?.id).toBe("wire-format");
  });

  it("reads path case as git does: another case is another file, outside the zone", () => {
    expect(legacyZoneOf("src/MessagePack/resolvers/dynamicObjectResolver.cs")).toBeNull();
  });

  it("does not read a backslash path as a zone path: git diff always writes forward slashes", () => {
    expect(legacyZoneOf(String.raw`src\MessagePack\MessagePackWriter.cs`)).toBeNull();
  });

  it("does not put a file in a folder that only starts like a zone folder in the zone", () => {
    expect(legacyZoneOf("src/MessagePack.UnityClientTools/Foo.cs")).toBeNull();
  });
});
