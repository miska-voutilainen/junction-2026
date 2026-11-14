import { describe, expect, it } from "vitest";
import { ReportCardSchema, type AnswerKey, type ChangeInput, type Review } from "../../contracts";
import { anchoredVsBlindVerdict, scoreReportCard, type EvalInput } from "./scoreEval";

type Finding = Review["findings"][number];

function bugKey(
  plantId: string,
  area: AnswerKey["area"],
  overrides: Partial<AnswerKey> = {},
): AnswerKey {
  return {
    plantId,
    changeId: "mp-1",
    kind: "planted-bug",
    area,
    file: "src/A.cs",
    startLine: 20,
    endLine: 25,
    defect: `synthetic defect ${plantId}`,
    why: "synthetic",
    writtenBy: "tester",
    writtenAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function sentenceKey(plantId: string, sentence: string): AnswerKey {
  return bugKey(plantId, null, {
    kind: "contradiction",
    file: null,
    startLine: null,
    endLine: null,
    defect: sentence,
  });
}

const changeOf = (id: string) =>
  ({ id, repo: "fork/repo", headSha: "a".repeat(40) }) as ChangeInput;

function defect(area: Finding["area"], startLine: number, id = "f1"): Finding {
  return {
    id,
    kind: "defect",
    area,
    severity: "high",
    title: "t",
    detail: "d",
    statement: null,
    hunkIds: [],
    citations: [{ file: "src/A.cs", side: "new", startLine, endLine: startLine, quote: "x" }],
  };
}

function contradiction(statement: string): Finding {
  return {
    id: "f1",
    kind: "contradiction",
    area: null,
    severity: "high",
    title: "t",
    detail: "d",
    statement,
    hunkIds: [],
    citations: [],
  };
}

function review(findings: Finding[], overrides: Partial<Review> = {}): Review {
  return {
    reviewer: { version: "rv1", model: "m", promptVersions: {} },
    findings,
    quoteCheck: {
      checked: 4,
      passed: 3,
      downgraded: 0,
      dropped: 1,
      failures: [{ itemId: "c1", citation: null, reason: "r" }],
    },
    retractions: [],
    ...overrides,
  } as unknown as Review;
}

function input(overrides: Partial<EvalInput>): EvalInput {
  return {
    plantedBugs: [],
    contradictions: [],
    runsPerMode: 0,
    otherReviews: [],
    now: new Date("2026-11-14T10:00:00Z"),
    ...overrides,
  };
}

const plant = (key: AnswerKey, ...reviews: (Review | null)[]) => ({
  key,
  change: changeOf(key.plantId),
  reviews,
});

describe("scoreReportCard planted bugs", () => {
  it("counts a catch per area, with the finding id and the commit link", () => {
    const card = scoreReportCard(
      input({
        plantedBugs: [
          plant(bugKey("v01", "security"), review([defect("security", 22, "f3")])),
          plant(bugKey("v02", "security"), review([defect("security", 40)])),
          plant(bugKey("v03", "analyzer"), null),
        ],
      }),
    );
    const security = card.areas.find((area) => area.area === "security");
    expect(security).toMatchObject({ planted: 2, caught: 1, spotChecksClean: 0 });
    expect(security?.plants[0]).toMatchObject({
      plantId: "v01",
      caught: true,
      findingId: "f3",
      variantUrl: `https://github.com/fork/repo/commit/${"a".repeat(40)}`,
    });
    expect(security?.plants[1]).toMatchObject({ caught: false, findingId: null });
    // A missing run counts as not caught.
    expect(card.areas.find((area) => area.area === "analyzer")).toMatchObject({
      planted: 1,
      caught: 0,
    });
  });

  it("counts a plant caught when a strict majority of its runs caught it, with the first catching run's finding", () => {
    const hit = (id: string) => review([defect("security", 22, id)]);
    const card = scoreReportCard(
      input({
        plantedBugs: [
          plant(bugKey("v01", "security"), review([]), hit("f2"), hit("f3")),
          plant(bugKey("v02", "security"), hit("f1"), review([]), null),
        ],
      }),
    );
    const security = card.areas.find((area) => area.area === "security");
    expect(security).toMatchObject({ planted: 2, caught: 1 });
    expect(security?.plants[0]).toMatchObject({ caught: true, runs: 3, caughtRuns: 2, findingId: "f2" });
    expect(security?.plants[1]).toMatchObject({ caught: false, runs: 3, caughtRuns: 1, findingId: "f1" });
  });

  it("counts findings on plants over every run", () => {
    const card = scoreReportCard(
      input({
        plantedBugs: [
          plant(bugKey("v01", "security"), review([defect("security", 22)]), review([defect("security", 22)])),
        ],
      }),
    );
    expect(card.findingsOnPlants).toEqual({ total: 2, matchedPlant: 2 });
  });

  it("does not catch on the wrong area or lines more than 3 away", () => {
    const card = scoreReportCard(
      input({
        plantedBugs: [
          plant(
            bugKey("v01", "security"),
            review([defect("generator", 22), defect("security", 29)]),
          ),
        ],
      }),
    );
    expect(card.areas.find((area) => area.area === "security")?.caught).toBe(0);
    expect(card.findingsOnPlants).toEqual({ total: 2, matchedPlant: 0 });
  });

  it("sets each area's level from its catch rate and keeps an empty area at Shadow", () => {
    const caughtAll = ["v01", "v02", "v03"].map((id) =>
      plant(bugKey(id, "security"), review([defect("security", 22)])),
    );
    const card = scoreReportCard(input({ plantedBugs: caughtAll }));
    expect(card.areas.map((area) => [area.area, area.planted, area.level])).toEqual([
      ["generator", 0, "shadow"],
      ["analyzer", 0, "shadow"],
      ["security", 3, "calibrated"],
      ["performance", 0, "shadow"],
    ]);
  });

  it("produces a card that passes the contract", () => {
    const card = scoreReportCard(
      input({ plantedBugs: [plant(bugKey("v01", "security"), review([defect("security", 22)]))] }),
    );
    const routingSpread = {
      changes: 0,
      light: 0,
      focused: 0,
      full: 0,
      readHunks: 0,
      totalHunks: 0,
      readMinutes: 0,
      fullMinutes: 0,
    };
    expect(ReportCardSchema.safeParse({ ...card, routingSpread }).success).toBe(true);
  });
});

describe("scoreReportCard anchored versus blind", () => {
  const sentence = "The cache is cleared on every write.";
  const key = sentenceKey("cp1", sentence);
  const caught = review([contradiction(sentence)]);
  const missed = review([]);

  it("counts caught runs per mode out of the measured n, a missing run as not caught", () => {
    const card = scoreReportCard(
      input({
        runsPerMode: 2,
        contradictions: [{ key, anchored: [caught, null], blind: [caught, caught] }],
      }),
    );
    expect(card.anchoredVsBlind).toMatchObject({
      plants: 1,
      runsPerMode: 2,
      anchored: { caught: 1, total: 2 },
      blind: { caught: 2, total: 2 },
      perPlant: [
        { plantId: "cp1", statement: sentence, anchoredCaught: 1, blindCaught: 2, runs: 2 },
      ],
    });
  });

  it("matches a trimmed statement by token overlap and rejects an unrelated one", () => {
    const card = scoreReportCard(
      input({
        runsPerMode: 2,
        contradictions: [
          {
            key,
            anchored: [
              review([contradiction("the cache is cleared on every write")]),
              review([contradiction("Something else entirely")]),
            ],
            blind: [missed, missed],
          },
        ],
      }),
    );
    expect(card.anchoredVsBlind.anchored.caught).toBe(1);
  });

  it("ignores a defect finding that quotes the sentence", () => {
    const card = scoreReportCard(
      input({
        runsPerMode: 1,
        contradictions: [
          {
            key,
            anchored: [review([{ ...contradiction(sentence), kind: "defect" }])],
            blind: [missed],
          },
        ],
      }),
    );
    expect(card.anchoredVsBlind.anchored.caught).toBe(0);
  });
});

describe("scoreReportCard totals", () => {
  it("sums hallucination counts over runs and other reviews", () => {
    const withRetraction = review([], {
      retractions: [{ claimId: "c1", reason: "r", output: "o" }],
    });
    const card = scoreReportCard(
      input({
        plantedBugs: [plant(bugKey("v01", "security"), review([]))],
        otherReviews: [withRetraction],
      }),
    );
    expect(card.hallucinations).toEqual({
      quotesChecked: 8,
      quoteFailures: 2,
      claimsRetracted: 1,
      findingsDropped: 2,
    });
  });

  it("takes the reviewer from the runs and refuses mixed versions", () => {
    const newer = review([], {
      reviewer: { version: "rv2", model: "m", promptVersions: {} } as Review["reviewer"],
    });
    const plantedBugs = [
      plant(bugKey("v01", "security"), review([])),
      plant(bugKey("v02", "security"), newer),
    ];
    expect(() => scoreReportCard(input({ plantedBugs }))).toThrow(
      "mixed reviewer versions: rerun all",
    );
    expect(scoreReportCard(input({ plantedBugs: plantedBugs.slice(0, 1) })).reviewer).toEqual({
      version: "rv1",
      model: "m",
    });
  });
});

describe("anchoredVsBlindVerdict", () => {
  const counts = (blind: number, anchored: number) => ({
    plants: 5,
    runsPerMode: 2,
    perPlant: [],
    anchored: { caught: anchored, total: 10 },
    blind: { caught: blind, total: 10 },
  });

  it("is a go only when blind caught more", () => {
    expect(anchoredVsBlindVerdict(counts(7, 4)).hasAdvantage).toBe(true);
    expect(anchoredVsBlindVerdict(counts(4, 4)).hasAdvantage).toBe(false);
    expect(anchoredVsBlindVerdict(counts(3, 4)).line).toContain("No-go");
  });

  it("names both counts with the sample size", () => {
    expect(anchoredVsBlindVerdict(counts(7, 4)).line).toBe(
      "Go: blind-first shows an advantage. Blind-first caught 7 of 10, anchored 4 of 10 (5 plants, 2 runs per mode).",
    );
  });
});
