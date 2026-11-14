import { describe, expect, it } from "vitest";
import type { Coverage } from "@/contracts";
import type { ReviewedRow } from "./inboxModel";
import { readCount, readingText } from "./rowText";

function rowWith(coverage: Coverage[], readHunks: number, readMinutes: number): ReviewedRow {
  return { coverage, readHunks, totalHunks: coverage.length, readMinutes } as ReviewedRow;
}

describe("readCount", () => {
  it("says only the read count when no hunk is generated", () => {
    expect(readCount(rowWith(["read", "verified"], 1, 1))).toBe("read 1 of 2");
  });

  it("names the generated hunks the count leaves out", () => {
    const row = rowWith(["read", "generated", "generated", "supported"], 1, 2);
    expect(readCount(row)).toBe("read 1 of 4 · 2 generated");
    expect(readingText(row)).toBe("read 1 of 4 · 2 generated · ~2 min");
  });
});
