import { describe, expect, it } from "vitest";
import type { Review } from "../../contracts";
import { hunksMatchingGlob } from "./hunksMatchingGlob";

const hunk = (id: string, file: string) => ({ id, file }) as Review["hunks"][number];

describe("hunksMatchingGlob", () => {
  const hunks = [
    hunk("h1", "tests/A/Resources/a.cs"),
    hunk("h2", "src/B.cs"),
    hunk("h3", "README.md"),
  ];

  it("matches repo-relative forward-slash paths with ** and *", () => {
    expect(hunksMatchingGlob("tests/**/Resources/**", hunks).map((h) => h.id)).toEqual(["h1"]);
    expect(hunksMatchingGlob("src/*.cs", hunks).map((h) => h.id)).toEqual(["h2"]);
  });

  it("matches nothing for an unrelated glob", () => {
    expect(hunksMatchingGlob("docs/**", hunks)).toEqual([]);
  });
});
