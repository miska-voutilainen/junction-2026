import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadChange, loadChanges, loadReceipt, loadReceiptText, loadReportCard, loadReview } from "./loaders";

let root: string;

// A data root that holds only the committed fixtures, so any "recorded" file is one the test adds.
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "countersign-data-"));
  await cp(path.join(process.cwd(), "data", "fixtures"), path.join(root, "fixtures"), { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

/** Writes a (optionally edited) copy of a fixture to the recorded location with the same relative path. */
async function record(relativePath: string, edit: (text: string) => string = (text) => text) {
  const text = await readFile(path.join(root, "fixtures", relativePath), "utf8");
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, edit(text));
}

describe("loaders", () => {
  it("falls back to the fixture when nothing is recorded", async () => {
    expect(await loadReview("mp-2283", root)).toMatchObject({ status: "ok", source: "fixture" });
  });

  it("prefers the recorded file over the fixture", async () => {
    await record("runs/mp-2283/review.json", (text) => text.replace("run-20261114-mp-2283", "run-recorded"));
    const result = await loadReview("mp-2283", root);
    expect(result).toMatchObject({ status: "ok", source: "recorded" });
    expect(result.status === "ok" && result.data.run.id).toBe("run-recorded");
  });

  it("returns missing when neither folder has the file", async () => {
    expect(await loadReview("mp-0000", root)).toEqual({ status: "missing" });
    expect(await loadReceipt("mp-2234", root)).toEqual({ status: "missing" });
  });

  it("returns missing for an id that is not a plain change id", async () => {
    expect(await loadReview("../eval/report-card", root)).toEqual({ status: "missing" });
  });

  it("returns invalid with the file and the failing field when a recorded file breaks its schema", async () => {
    await record("runs/mp-2283/review.json", (text) => text.replace('"schemaVersion": 1', '"schemaVersion": 2'));
    const result = await loadReview("mp-2283", root);
    expect(result.status).toBe("invalid");
    const error = result.status === "invalid" ? result.error : "";
    expect(error).toContain("review.json");
    expect(error).toContain("schemaVersion");
  });

  it("returns invalid for a file that is not JSON", async () => {
    await record("eval/report-card.json", () => "{ not json");
    expect(await loadReportCard(root)).toMatchObject({ status: "invalid" });
  });

  it("lists the four Tieto changes sorted by id", async () => {
    const result = await loadChanges(root);
    expect(result).toMatchObject({ status: "ok", source: "fixture" });
    expect(result.status === "ok" && result.data.map((change) => change.id)).toEqual([
      "mp-2129",
      "mp-2234",
      "mp-2283",
      "mp-2297",
    ]);
  });

  it("uses the recorded folder alone once it has files, and skips planted-bug inputs", async () => {
    await record("sample/changes/mp-2283.json");
    const original = await readFile(path.join(root, "sample/changes/mp-2283.json"), "utf8");
    await writeFile(
      path.join(root, "sample/changes/v01.json"),
      original.replace('"id": "mp-2283"', '"id": "v01"').replace('"kind": "tieto"', '"kind": "planted-bug"'),
    );
    const result = await loadChanges(root);
    expect(result).toMatchObject({ status: "ok", source: "recorded" });
    expect(result.status === "ok" && result.data.map((change) => change.id)).toEqual(["mp-2283"]);
  });

  it("loads a change, the report card and a receipt", async () => {
    expect(await loadChange("mp-2297", root)).toMatchObject({ status: "ok" });
    expect(await loadReportCard(root)).toMatchObject({ status: "ok", source: "fixture" });
    expect(await loadReceipt("mp-2283", root)).toMatchObject({ status: "ok" });
  });

  it("returns missing when there are no changes anywhere", async () => {
    await rm(path.join(root, "fixtures", "sample", "changes"), { recursive: true });
    expect(await loadChanges(root)).toEqual({ status: "missing" });
  });
});

describe("loadReceiptText", () => {
  it("returns the file's exact text, recorded before fixture", async () => {
    const fixtureText = await readFile(path.join(root, "fixtures", "receipts", "mp-2283.json"), "utf8");
    expect(await loadReceiptText("mp-2283", root)).toBe(fixtureText);
    await record("receipts/mp-2283.json", (text) => text.replace("rv1", "rv2"));
    expect(await loadReceiptText("mp-2283", root)).toBe(fixtureText.replace("rv1", "rv2"));
  });

  it("returns null when there is no receipt or the id could leave data/", async () => {
    expect(await loadReceiptText("mp-2234", root)).toBeNull();
    expect(await loadReceiptText("../secrets", root)).toBeNull();
  });
});
