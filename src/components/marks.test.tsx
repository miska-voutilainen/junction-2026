import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { coverageLabel, evidenceLevelLabel, ladderLevelLabel, tierLabel } from "@/contracts";
import type { Coverage, EvidenceLevel, LadderLevel, Tier } from "@/contracts";
import { AreaChip } from "./AreaChip";
import { CoverageMark } from "./CoverageMark";
import { EvidenceBadge } from "./EvidenceMark";
import { IdeaLabel } from "./IdeaLabel";
import { LevelLadder } from "./LevelLadder";
import { TIER_BARS, TierBadge } from "./TierBadge";

afterEach(cleanup);

describe("EvidenceBadge", () => {
  it.each(Object.keys(evidenceLevelLabel) as EvidenceLevel[])("shows the %s label", (level) => {
    render(<EvidenceBadge level={level} />);
    expect(screen.getByText(evidenceLevelLabel[level])).toBeDefined();
  });
});

describe("CoverageMark", () => {
  it.each(Object.keys(coverageLabel) as Coverage[])("shows the %s label", (coverage) => {
    render(<CoverageMark coverage={coverage} />);
    expect(screen.getByText(coverageLabel[coverage])).toBeDefined();
  });
});

describe("TierBadge", () => {
  it.each(Object.keys(tierLabel) as Tier[])("shows the %s label and its lit bars", (tier) => {
    render(<TierBadge tier={tier} />);
    expect(screen.getByText(tierLabel[tier])).toBeDefined();
    const bars = screen.getAllByTestId("tier-bar");
    expect(bars).toHaveLength(3);
    expect(bars.filter((bar) => bar.dataset.lit === "true")).toHaveLength(TIER_BARS[tier]);
  });
});

describe("LevelLadder", () => {
  it.each([
    ["shadow", 1],
    ["calibrated", 2],
    ["trusted", 3],
  ] as [LadderLevel, number][])("names the current level %s", (level, step) => {
    render(<LevelLadder level={level} />);
    const name = `Level: ${ladderLevelLabel[level]}, step ${step} of 3`;
    expect(screen.getByRole("img", { name })).toBeDefined();
  });
});

describe("AreaChip", () => {
  it("shows the area name", () => {
    render(<AreaChip area="analyzer" />);
    expect(screen.getByText("Analyzer")).toBeDefined();
  });
});

describe("IdeaLabel", () => {
  it("opens the idea page in a new tab with a descriptive name", () => {
    render(<IdeaLabel n={3} />);
    const link = screen.getByRole("link", { name: "Idea 3 · Hunk coverage map, opens in a new tab" });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener");
  });
});
