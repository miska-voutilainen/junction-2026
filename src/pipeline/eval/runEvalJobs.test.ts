import { describe, expect, it, vi } from "vitest";
import type { AnswerKey, Review } from "../../contracts";
import {
  EVAL_CONCURRENCY,
  planEvalJobs,
  runEvalJobs,
  type EvalJob,
  type EvalStore,
} from "./runEvalJobs";

function key(plantId: string, kind: AnswerKey["kind"], changeId = "mp-1"): AnswerKey {
  return {
    plantId,
    changeId,
    kind,
    area: null,
    file: null,
    startLine: null,
    endLine: null,
    defect: "d",
    why: "w",
    writtenBy: "t",
    writtenAt: "2026-01-01T00:00:00Z",
  };
}

const keys = [
  key("v01", "planted-bug"),
  key("cp0", "contradiction", "mp-2283"),
  key("cp1", "contradiction", "mp-2283"),
];
const inputOf = (answerKey: AnswerKey) =>
  answerKey.plantId === "cp0" ? answerKey.changeId : answerKey.plantId;

describe("planEvalJobs", () => {
  it("plans A1-A3 for a planted bug and A1, A2, A4 blind plus A2, A4 anchored per contradiction run", () => {
    const jobs = planEvalJobs(keys, 2, inputOf).flat();
    expect(jobs.filter((job) => !job.comparison).map((job) => [job.label, job.steps])).toEqual([
      ["v01", ["a1", "a2", "a3"]],
    ]);
    const comparison = jobs.filter((job) => job.comparison);
    expect(comparison).toHaveLength(2 * 2 * 2);
    expect(comparison.find((job) => job.label === "cp0 blind 1")).toMatchObject({
      changeInputId: "mp-2283",
      mode: "blind-first",
      steps: ["a1", "a2", "a4"],
    });
    expect(comparison.find((job) => job.label === "cp1 anchored 2")).toMatchObject({
      changeInputId: "cp1",
      mode: "anchored",
      steps: ["a2", "a4"],
      comparison: { mode: "anchored", runNumber: 2 },
    });
  });

  it("puts the blind runs of one Tieto change and run number in one group, so they run in turn", () => {
    const groups = planEvalJobs(keys, 1, inputOf);
    const blind = groups.find((group) => group.some((job) => job.label === "cp0 blind 1"));
    expect(blind?.map((job) => job.label)).toEqual(["cp0 blind 1", "cp1 blind 1"]);
  });

  it("plans only as many runs as asked for", () => {
    expect(
      planEvalJobs(keys, 3, inputOf)
        .flat()
        .filter((job) => job.comparison),
    ).toHaveLength(12);
  });
});

const reviewAt = (version: string, costUsd = 0.5) =>
  ({ reviewer: { version }, run: { usage: { costUsd } } }) as unknown as Review;

describe("runEvalJobs", () => {
  const job = (label: string): EvalJob => ({
    label,
    changeInputId: label,
    mode: "blind-first",
    steps: ["a1", "a2"],
  });

  it("reuses a current run without recording and re-records a stale one", async () => {
    const store: EvalStore = {
      load: async (j) =>
        j.label === "current" ? reviewAt("rv2") : j.label === "stale" ? reviewAt("rv0") : null,
      record: vi.fn(async () => reviewAt("rv2", 1.25)),
    };
    const outcomes = await runEvalJobs([[job("current")], [job("stale")], [job("none")]], store);
    const status = Object.fromEntries(
      outcomes.map((outcome) => [outcome.job.label, outcome.status]),
    );
    expect(status).toEqual({ current: "reused", stale: "ran", none: "ran" });
    expect(store.record).toHaveBeenCalledTimes(2);
    expect(outcomes.reduce((sum, outcome) => sum + outcome.costUsd, 0)).toBe(2.5);
  });

  it("retries a failed run once, then reports it failed without throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let attempts = 0;
    const flaky: EvalStore = {
      load: async () => null,
      record: async () => {
        if (++attempts < 2) throw new Error("schema");
        return reviewAt("rv2");
      },
    };
    expect((await runEvalJobs([[job("a")]], flaky))[0].status).toBe("ran");

    const broken: EvalStore = {
      load: async () => null,
      record: vi.fn(async () => {
        throw new Error("timeout");
      }),
    };
    const [outcome] = await runEvalJobs([[job("b")]], broken);
    expect(outcome).toMatchObject({ status: "failed", review: null });
    expect(broken.record).toHaveBeenCalledTimes(2);
  });

  it("runs groups side by side up to the concurrency limit, and a group's jobs in turn", async () => {
    let running = 0;
    let peak = 0;
    const store: EvalStore = {
      load: async () => null,
      record: async () => {
        running++;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 5));
        running--;
        return reviewAt("rv2");
      },
    };
    await runEvalJobs(
      Array.from({ length: 10 }, (_, index) => [job(`g${index}`)]),
      store,
    );
    expect(peak).toBe(EVAL_CONCURRENCY);

    peak = 0;
    await runEvalJobs([[job("x"), job("y"), job("z")]], store);
    expect(peak).toBe(1);
  });
});
