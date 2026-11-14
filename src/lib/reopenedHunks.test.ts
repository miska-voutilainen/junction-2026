import { describe, expect, it } from "vitest";
import type { Coverage, Receipt } from "@/contracts";
import { reopenedHunks } from "./reopenedHunks";

const ledger: Receipt["hunks"] = [
  { hunkId: "h1", file: "a.cs", coverage: "read", readBy: "owner" },
  { hunkId: "h2", file: "a.cs", coverage: "verified", readBy: null },
  { hunkId: "h3", file: "b.cs", coverage: "supported", readBy: null },
];

const calm: Record<string, Coverage> = { h1: "read", h2: "verified", h3: "supported" };

describe("reopenedHunks", () => {
  it("leaves out hunks that were already read without any escape", () => {
    expect(
      reopenedHunks(ledger, { h1: "read", h2: "read", h3: "read" }, { ...calm, h2: "read" }),
    ).toEqual(["h3"]);
  });

  it("returns nothing when routing still matches the signed ledger", () => {
    expect(reopenedHunks(ledger, { h1: "read", h2: "verified", h3: "supported" }, calm)).toEqual(
      [],
    );
  });

  it("returns the hunks that are now read and that the signer did not read, in ledger order", () => {
    expect(reopenedHunks(ledger, { h1: "read", h2: "read", h3: "read" }, calm)).toEqual([
      "h2",
      "h3",
    ]);
  });

  it("ignores hunk ids the current routing does not know", () => {
    expect(reopenedHunks(ledger, { h1: "read", h9: "read" }, calm)).toEqual([]);
  });
});
