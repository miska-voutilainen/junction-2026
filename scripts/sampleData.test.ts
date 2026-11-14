/**
 * Sample data check: every file under data/sample/ parses against its contract
 * in src/contracts/, every change has its requirement, and the one false
 * statement in mp-2283's description is recorded verbatim in the answer key
 * (spec section 9.1, T07). Needs no clone of the fork.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AnswerKeySchema,
  ChangeInputSchema,
  RequirementSchema,
} from "../src/contracts";

const SAMPLE_DIR = join(__dirname, "..", "data", "sample");
const TIETO_CHANGE_IDS = ["mp-2283", "mp-2234", "mp-2129", "mp-2297"];
// Spec 9.1 T07: a description is 80 to 200 words, so a reviewer can read it in seconds.
const MIN_DESCRIPTION_WORDS = 80;
const MAX_DESCRIPTION_WORDS = 200;
const MAX_TITLE_LENGTH = 70;

function readJsonFiles(folder: string): { file: string; json: unknown }[] {
  return readdirSync(join(SAMPLE_DIR, folder))
    .filter((file) => file.endsWith(".json"))
    .map((file) => ({
      file,
      json: JSON.parse(readFileSync(join(SAMPLE_DIR, folder, file), "utf8")),
    }));
}

const changes = readJsonFiles("changes").map(({ file, json }) => ({
  file,
  change: ChangeInputSchema.parse(json),
}));
const requirements = readJsonFiles("requirements").map(({ json }) =>
  RequirementSchema.parse(json),
);
const answerKeys = readJsonFiles("answer-key").map(({ file, json }) => ({
  file,
  key: AnswerKeySchema.parse(json),
}));

describe("sample data", () => {
  it("has the four Tieto changes, each named after its file", () => {
    const tieto = changes.filter(({ change }) => change.kind === "tieto");
    expect(tieto.map(({ change }) => change.id).sort()).toEqual(
      [...TIETO_CHANGE_IDS].sort(),
    );
    for (const { file, change } of changes) {
      expect(file).toBe(`${change.id}.json`);
    }
  });

  it("gives every change a requirement, named after its file", () => {
    for (const { change } of changes) {
      const requirement = requirements.find(
        ({ id }) => id === change.requirementId,
      );
      expect(requirement, `requirement for ${change.id}`).toBeDefined();
    }
    for (const requirement of requirements) {
      expect(requirement.derivedFrom.url).toContain(
        `/issues/${requirement.id.replace("MP-", "")}`,
      );
    }
  });

  it("keeps titles short and descriptions marked synthetic and 80 to 200 words", () => {
    for (const { change } of changes) {
      expect(change.title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
      expect(change.authorDescription.synthetic).toBe(true);
      const words = change.authorDescription.text.split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(MIN_DESCRIPTION_WORDS);
      expect(words).toBeLessThanOrEqual(MAX_DESCRIPTION_WORDS);
    }
  });

  it("numbers requirement items F1.. and N1.. within the spec's counts", () => {
    for (const requirement of requirements) {
      expect(requirement.functional.map(({ id }) => id)).toEqual(
        requirement.functional.map((_, index) => `F${index + 1}`),
      );
      expect(requirement.nonFunctional.map(({ id }) => id)).toEqual(
        requirement.nonFunctional.map((_, index) => `N${index + 1}`),
      );
      expect(requirement.functional.length).toBeGreaterThanOrEqual(2);
      expect(requirement.functional.length).toBeLessThanOrEqual(5);
      expect(requirement.nonFunctional.length).toBeGreaterThanOrEqual(1);
      expect(requirement.nonFunctional.length).toBeLessThanOrEqual(3);
    }
  });

  it("records cp0's sentence verbatim in mp-2283's description", () => {
    const cp0 = answerKeys.find(({ key }) => key.plantId === "cp0")?.key;
    const mp2283 = changes.find(
      ({ change }) => change.id === "mp-2283",
    )?.change;
    expect(cp0).toBeDefined();
    expect(cp0?.changeId).toBe("mp-2283");
    expect(cp0?.kind).toBe("contradiction");
    expect(mp2283?.authorDescription.text).toContain(cp0?.defect);
  });

  it("names each answer key after its file and a known change", () => {
    const changeIds = changes.map(({ change }) => change.id);
    for (const { file, key } of answerKeys) {
      expect(file).toBe(`${key.plantId}.json`);
      expect(changeIds).toContain(key.changeId);
    }
  });
});
