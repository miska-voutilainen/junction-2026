import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReportCardSchema, ReviewSchema, type Review } from "../../contracts";

const fixture = ReviewSchema.parse(
  JSON.parse(
    readFileSync(path.join(__dirname, "../../../data/fixtures/runs/mp-2283/review.json"), "utf8"),
  ),
);
const sentence = "The cache is cleared on every write.";
const originalCwd = process.cwd();
let root: string;

function writeJson(relative: string, value: unknown): void {
  const file = path.join(root, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

/** The fixture review as a run of `changeId` in `mode` with these findings. */
function run(
  changeId: string,
  mode: Review["mode"],
  findings: Review["findings"],
  version = "rv2",
): Review {
  return {
    ...fixture,
    changeId,
    mode,
    findings,
    reviewer: { ...fixture.reviewer, version },
  };
}

const contradiction: Review["findings"][number] = {
  id: "f1",
  kind: "contradiction",
  area: null,
  severity: "high",
  title: "t",
  detail: "d",
  statement: sentence,
  hunkIds: [],
  citations: [],
};

function key(plantId: string, overrides: Record<string, unknown>) {
  return {
    plantId,
    changeId: "mp-2283",
    kind: "contradiction",
    area: null,
    file: null,
    startLine: null,
    endLine: null,
    defect: sentence,
    why: "synthetic",
    writtenBy: "tester",
    writtenAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "countersign-eval-"));
  mkdirSync(path.join(root, "docs"));
  writeJson("data/sample/answer-key/cp0.json", key("cp0", {}));
  writeJson(
    "data/sample/answer-key/v01.json",
    key("v01", {
      kind: "planted-bug",
      area: "generator",
      file: "src/A.cs",
      startLine: 10,
      endLine: 12,
      defect: "synthetic defect",
    }),
  );
  writeJson("data/sample/changes/v01.json", {
    id: "v01",
    kind: "planted-bug",
    title: "t",
    requirementId: "MP-1",
    parentChangeId: "mp-2283",
    repo: "fork/repo",
    branch: "b",
    baseSha: "a".repeat(40),
    headSha: "b".repeat(40),
    authorAgent: "agent",
    authorDescription: { text: "d", synthetic: true, writtenBy: "t" },
  });
  writeJson("data/runs/v01/review.json", run("v01", "blind-first", []));
  writeJson("data/runs/mp-2283/anchored/1.json", run("mp-2283", "anchored", [contradiction]));
  writeJson("data/runs/mp-2283/blind/1.json", run("mp-2283", "blind-first", []));
  writeJson("data/runs/mp-2283/review.json", fixture);
  process.chdir(root);
  vi.resetModules();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.chdir(originalCwd);
  vi.restoreAllMocks();
});

describe("pnpm evals --score-only", () => {
  it("reads cp0's runs from the mp-2283 folder, measures n from the files and writes the card", async () => {
    const { runEvalCommand } = await import("./evalCommand");
    await runEvalCommand(["--score-only"]);

    const card = ReportCardSchema.parse(
      JSON.parse(readFileSync(path.join(root, "data/eval/report-card.json"), "utf8")),
    );
    expect(card.anchoredVsBlind).toMatchObject({
      plants: 1,
      runsPerMode: 1,
      anchored: { caught: 1, total: 1 },
      blind: { caught: 0, total: 1 },
    });
    expect(card.areas.find((area) => area.area === "generator")).toMatchObject({
      planted: 1,
      caught: 0,
    });
    expect(card.routingSpread.changes).toBe(1);
  });

  it("measures a planted bug's runs from disk: review.json is run 1, blind/<k>.json the rest", async () => {
    writeJson("data/runs/v01/blind/2.json", run("v01", "blind-first", []));
    const { runEvalCommand } = await import("./evalCommand");
    await runEvalCommand(["--score-only"]);

    const card = ReportCardSchema.parse(
      JSON.parse(readFileSync(path.join(root, "data/eval/report-card.json"), "utf8")),
    );
    const generator = card.areas.find((area) => area.area === "generator");
    expect(generator?.plants[0]).toMatchObject({ plantId: "v01", runs: 2, caughtRuns: 0 });
  });

  it("writes the Tieto review back routed with the measured levels and logs the verdict", async () => {
    const { runEvalCommand } = await import("./evalCommand");
    await runEvalCommand(["--score-only"]);

    const card = JSON.parse(readFileSync(path.join(root, "data/eval/report-card.json"), "utf8"));
    const rewritten = ReviewSchema.parse(
      JSON.parse(readFileSync(path.join(root, "data/runs/mp-2283/review.json"), "utf8")),
    );
    // One plant, so every area stays Shadow and routing reads the most.
    expect(card.areas.every((area: { level: string }) => area.level === "shadow")).toBe(true);
    expect(rewritten.routing.readHunks).toBeGreaterThanOrEqual(fixture.routing.readHunks);
    expect(readFileSync(path.join(root, "docs/lessons.md"), "utf8")).toContain("No-go: no advantage");
  });

  it("rejects a --plant-runs that is not a whole number from 1", async () => {
    const { runEvalCommand } = await import("./evalCommand");
    await expect(runEvalCommand(["--plant-runs", "0"])).rejects.toThrow(
      "--plant-runs takes a whole number from 1",
    );
  });

  it("rejects a --runs that is not a whole number from 1", async () => {
    const { runEvalCommand } = await import("./evalCommand");
    await expect(runEvalCommand(["--runs", "0"])).rejects.toThrow(
      "--runs takes a whole number from 1",
    );
  });
});

describe("loadEvalRun", () => {
  it("refuses a file that holds another change or the other mode", async () => {
    writeJson("data/runs/v01/review.json", run("v02", "blind-first", []));
    writeJson("data/runs/mp-2283/blind/1.json", run("mp-2283", "anchored", []));
    const { loadEvalRun } = await import("./evalCommand");
    await expect(loadEvalRun("v01", undefined, true)).rejects.toThrow("holds v02");
    await expect(loadEvalRun("mp-2283", { mode: "blind", runNumber: 1 }, true)).rejects.toThrow(
      "(anchored)",
    );
  });

  it("counts a run of another reviewer version as no run after a full run, not in score-only", async () => {
    writeJson("data/runs/v01/review.json", run("v01", "blind-first", [], "rv0"));
    const { loadEvalRun } = await import("./evalCommand");
    expect(await loadEvalRun("v01", undefined, true)).toBeNull();
    expect(await loadEvalRun("v01", undefined, false)).not.toBeNull();
  });
});
