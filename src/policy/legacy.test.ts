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
