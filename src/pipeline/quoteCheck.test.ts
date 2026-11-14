import { describe, expect, it } from "vitest";
import type { Citation, Review } from "../contracts";
import {
  checkCitation,
  checkClaims,
  normalizeWhitespace,
  type IdentifiedClaimDraft,
  type SideReader,
} from "./quoteCheck";

type Hunk = Review["hunks"][number];

const headFile = [
  "class Resolver",
  "{",
  "    int Count = 0;",
  "    if (items.Length  > 0)   Run();",
  "}",
].join("\n");
const baseFile = ["class Resolver", "{", "    int Count = 1;", "}"].join("\n");

function readerOf(files: Partial<Record<`${Citation["side"]}:${string}`, string>>): SideReader {
  return async (side, file) => files[`${side}:${file}`] ?? null;
}

const reader = readerOf({ "new:src/Resolver.cs": headFile, "old:src/Resolver.cs": baseFile });

function citation(overrides: Partial<Citation> = {}): Citation {
  return {
    file: "src/Resolver.cs",
    side: "new",
    startLine: 3,
    endLine: 4,
    quote: "int Count = 0;",
    ...overrides,
  };
}

function hunk(id: string, file: string, added: string[]): Hunk {
  return {
    id,
    file,
    header: "@@ -1,1 +1,1 @@",
    oldStart: 1,
    oldLines: 1,
    newStart: 1,
    newLines: added.length,
    lines: added.map((text, index) => ({
      kind: "add" as const,
      oldLine: null,
      newLine: index + 1,
      text,
    })),
  };
}

function draft(overrides: Partial<IdentifiedClaimDraft> = {}): IdentifiedClaimDraft {
  return {
    id: "c1",
    requirementItemId: "F1",
    text: "The resolver counts items.",
    kind: "behaviour",
    hunkIds: ["h1"],
    pathGlob: null,
    citations: [citation()],
    ...overrides,
  };
}

describe("normalizeWhitespace", () => {
  it("turns CRLF and every whitespace run, newlines included, into one space and trims", () => {
    expect(normalizeWhitespace("  a\r\n\tb   c\n\n d  ")).toBe("a b c d");
  });
});

describe("checkCitation", () => {
  it("passes a quote that is on the cited lines", async () => {
    expect(await checkCitation(citation(), reader)).toEqual({ passed: true });
  });

  it("fails a deliberately wrong quote and says where it looked", async () => {
    const result = await checkCitation(citation({ quote: "int Count = 42;" }), reader);
    expect(result).toEqual({
      passed: false,
      reason: "quote not found in lines 3–4 of the new file",
    });
  });

  it("matches case-sensitively", async () => {
    expect((await checkCitation(citation({ quote: "INT COUNT = 0;" }), reader)).passed).toBe(false);
  });

  it("ignores whitespace differences, including a quote re-wrapped across lines", async () => {
    const rewrapped = citation({ quote: "if (items.Length  >\n 0) Run();" });
    expect((await checkCitation(rewrapped, reader)).passed).toBe(true);
  });

  it("reads a CRLF file the same as an LF file", async () => {
    const crlf = readerOf({ "new:src/Resolver.cs": headFile.replace(/\n/g, "\r\n") });
    expect((await checkCitation(citation(), crlf)).passed).toBe(true);
  });

  it("fails a quote that exists in the file but outside the cited lines", async () => {
    expect((await checkCitation(citation({ startLine: 1, endLine: 2 }), reader)).passed).toBe(
      false,
    );
  });

  it("checks the old side against the base file", async () => {
    const old = citation({ side: "old", startLine: 3, endLine: 3, quote: "int Count = 1;" });
    expect((await checkCitation(old, reader)).passed).toBe(true);
    expect((await checkCitation({ ...old, quote: "int Count = 0;" }, reader)).passed).toBe(false);
  });

  it("fails with 'file not present' when the file is missing on that side", async () => {
    const newOnly = readerOf({ "new:src/Added.cs": "x" });
    const result = await checkCitation(
      citation({ file: "src/Added.cs", side: "old", startLine: 1, endLine: 1, quote: "x" }),
      newOnly,
    );
    expect(result).toEqual({ passed: false, reason: "file not present on old" });
  });

  it("fails an empty quote instead of letting it match everywhere", async () => {
    expect(await checkCitation(citation({ quote: "  " }), reader)).toEqual({
      passed: false,
      reason: "empty quote",
    });
  });
});

describe("checkClaims", () => {
  const hunks = [hunk("h1", "src/Resolver.cs", ["int Count = 0;"])];

  it("marks a claim with a passing citation supported, with one quote-check evidence entry", async () => {
    const { claims, quoteCheck } = await checkClaims([draft()], hunks, reader);
    expect(claims[0].level).toBe("supported");
    expect(claims[0].evidence).toEqual([
      {
        kind: "quote-check",
        summary: "Quote checked against the code at src/Resolver.cs:3–4",
        testName: null,
        base: null,
        head: null,
      },
    ]);
    expect(quoteCheck).toEqual({ checked: 1, passed: 1, downgraded: 0, dropped: 0, failures: [] });
  });

  it("removes failing citations from a supported claim and records each failure with the claim id", async () => {
    const wrong = citation({ quote: "int Count = 42;" });
    const { claims, quoteCheck } = await checkClaims(
      [draft({ citations: [wrong, citation()] })],
      hunks,
      reader,
    );
    expect(claims[0].level).toBe("supported");
    expect(claims[0].citations).toEqual([citation()]);
    expect(quoteCheck.failures).toEqual([
      { itemId: "c1", citation: wrong, reason: "quote not found in lines 3–4 of the new file" },
    ]);
    expect(quoteCheck).toMatchObject({ checked: 2, passed: 1, downgraded: 0 });
  });

  it("downgrades a claim whose citations all fail to unverified with no citations, and keeps it", async () => {
    const wrong = citation({ quote: "int Count = 42;" });
    const { claims, quoteCheck } = await checkClaims(
      [draft({ citations: [wrong] })],
      hunks,
      reader,
    );
    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({ level: "unverified", citations: [], evidence: [] });
    expect(quoteCheck).toMatchObject({ checked: 1, passed: 0, downgraded: 1, dropped: 0 });
  });

  it("makes a claim without citations unverified", async () => {
    const { claims, quoteCheck } = await checkClaims([draft({ citations: [] })], hunks, reader);
    expect(claims[0].level).toBe("unverified");
    expect(quoteCheck.downgraded).toBe(1);
  });

  describe("hunk coverage by citation", () => {
    const two = [
      {
        ...hunk("h1", "src/Resolver.cs", ["x"]),
        newStart: 1,
        newLines: 2,
        oldStart: 1,
        oldLines: 2,
      },
      {
        ...hunk("h2", "src/Resolver.cs", ["y"]),
        newStart: 10,
        newLines: 3,
        oldStart: 9,
        oldLines: 3,
      },
    ];

    it("keeps only the hunks a passing citation lies in and counts the ones it removes", async () => {
      const { claims, hunkIdsRemoved } = await checkClaims(
        [
          draft({
            hunkIds: ["h1", "h2"],
            citations: [citation({ startLine: 1, endLine: 2, quote: "class Resolver" })],
          }),
        ],
        two,
        reader,
      );
      expect(claims[0].level).toBe("supported");
      expect(claims[0].hunkIds).toEqual(["h1"]);
      expect(hunkIdsRemoved).toBe(1);
    });

    it("uses old-side line numbers for an old-side citation", async () => {
      // Old line 3 lies in h2 (old 3-3) but not in h1 (old 1-2); new-side numbers are not consulted.
      const hunksWithOld = [two[0], { ...two[1], oldStart: 3, oldLines: 1 }];
      const { claims } = await checkClaims(
        [
          draft({
            hunkIds: ["h1", "h2"],
            citations: [
              citation({ side: "old", startLine: 3, endLine: 3, quote: "int Count = 1;" }),
            ],
          }),
        ],
        hunksWithOld,
        reader,
      );
      expect(claims[0].hunkIds).toEqual(["h2"]);
    });

    it("leaves the hunkIds of an unverified claim as the model wrote them", async () => {
      const { claims, hunkIdsRemoved } = await checkClaims(
        [draft({ hunkIds: ["h1", "h2"], citations: [] })],
        two,
        reader,
      );
      expect(claims[0].hunkIds).toEqual(["h1", "h2"]);
      expect(hunkIdsRemoved).toBe(0);
    });
  });

  describe("pathGlob", () => {
    const snapshots = [
      hunk("h1", "tests/A/Resources/a.cs", ["int Count = 0;", "// a"]),
      hunk("h2", "tests/A/Resources/b.cs", ["int Count = 0;"]),
      hunk("h3", "src/Other.cs", ["int Count = 0;"]),
    ];
    const globReader = readerOf({ "new:src/Resolver.cs": headFile });

    it("expands the glob to every matching hunk and ignores the hunkIds the model wrote", async () => {
      const { claims } = await checkClaims(
        [draft({ pathGlob: "tests/**/Resources/**", hunkIds: ["h3"] })],
        snapshots,
        globReader,
      );
      expect(claims[0].hunkIds).toEqual(["h1", "h2"]);
      expect(claims[0].level).toBe("supported");
    });

    it("downgrades the claim when the first quote is not in the added lines of every expanded hunk", async () => {
      const uneven = [snapshots[0], hunk("h2", "tests/A/Resources/b.cs", ["something else"])];
      const { claims, quoteCheck } = await checkClaims(
        [draft({ pathGlob: "tests/**/Resources/**" })],
        uneven,
        globReader,
      );
      expect(claims[0].level).toBe("unverified");
      expect(quoteCheck.failures[0]).toMatchObject({
        itemId: "c1",
        reason: "quote not in the added lines of h2",
      });
      expect(quoteCheck).toMatchObject({ checked: 1, passed: 0, downgraded: 1 });
    });

    it("downgrades the claim when the first citation is invented, even if a second one passes", async () => {
      const invented = citation({ quote: "int Count = 42;" });
      const real = citation();
      const { claims } = await checkClaims(
        [draft({ pathGlob: "tests/**/Resources/**", citations: [invented, real] })],
        snapshots,
        globReader,
      );
      expect(claims[0].level).toBe("unverified");
      expect(claims[0].citations).toEqual([]);
    });

    it("downgrades a glob claim that has no citation", async () => {
      const { claims } = await checkClaims(
        [draft({ pathGlob: "tests/**/Resources/**", citations: [] })],
        snapshots,
        globReader,
      );
      expect(claims[0].level).toBe("unverified");
    });

    it("rejects a quote that spans a gap of unchanged lines between added runs", async () => {
      const gapped: Hunk = {
        ...hunk("h1", "tests/A/Resources/a.cs", ["first", "second"]),
        lines: [
          { kind: "add", oldLine: null, newLine: 1, text: "first" },
          { kind: "context", oldLine: 1, newLine: 2, text: "between" },
          { kind: "add", oldLine: null, newLine: 3, text: "second" },
        ],
      };
      const spanning = citation({ quote: "first second" });
      const { claims } = await checkClaims(
        [draft({ pathGlob: "tests/**/Resources/**", citations: [spanning] })],
        [gapped],
        globReader,
      );
      expect(claims[0].level).toBe("unverified");
    });

    it("looks only at added lines, not at context or removed lines", async () => {
      const removedOnly: Hunk = {
        ...snapshots[1],
        lines: [{ kind: "del", oldLine: 1, newLine: null, text: "int Count = 0;" }],
      };
      const { claims } = await checkClaims(
        [draft({ pathGlob: "tests/**/Resources/**" })],
        [snapshots[0], removedOnly],
        globReader,
      );
      expect(claims[0].level).toBe("unverified");
    });
  });
});
