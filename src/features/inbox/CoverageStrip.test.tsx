import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Coverage } from "@/contracts";
import { CoverageStrip } from "./CoverageStrip";

function cells(coverage: Coverage[]): string[] {
  const { container } = render(<CoverageStrip coverage={coverage} />);
  return [...container.firstElementChild!.children].map((cell) =>
    cell.className.includes("w-6") ? "block" : "cell",
  );
}

describe("CoverageStrip", () => {
  it("draws mp-2297's 21 read hunks and 402 generated ones as 21 cells and one block", () => {
    const coverage: Coverage[] = [
      ...Array<Coverage>(21).fill("read"),
      ...Array<Coverage>(402).fill("generated"),
    ];
    expect(cells(coverage)).toEqual([...Array<string>(21).fill("cell"), "block"]);
  });

  it("keeps a short generated run as one cell per hunk", () => {
    expect(cells(["read", "generated", "generated", "verified"])).toEqual([
      "cell",
      "cell",
      "cell",
      "cell",
    ]);
  });

  it("keeps diff order: each long generated run is its own block", () => {
    const coverage: Coverage[] = [
      ...Array<Coverage>(5).fill("generated"),
      "read",
      ...Array<Coverage>(4).fill("generated"),
    ];
    expect(cells(coverage)).toEqual(["block", "cell", "block"]);
  });
});
