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
const TIETO_BASE_SHA = "32258fdbee4bcd653c79f51b4376b5103c6f4d27";
const DESCRIPTION_WRITTEN_BY =
  "engine lane (Miska), drafted by a Claude Sonnet builder without opening prompts, pipeline or review output";
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
const requirements = readJsonFiles("requirements").map(({ file, json }) => ({
  file,
  requirement: RequirementSchema.parse(json),
}));
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

  it("fixes the fields spec 9.1 sets for the four Tieto changes", () => {
    for (const { change } of changes) {
      const number = change.id.replace("mp-", "");
      expect(change.baseSha).toBe(TIETO_BASE_SHA);
      expect(change.parentChangeId).toBeNull();
      expect(change.branch).toBe(`ju26-issue-${number}`);
      expect(change.requirementId).toBe(`MP-${number}`);
      expect(change.authorAgent).toBe("Coding agent (Tieto sample)");
      expect(change.authorDescription.writtenBy).toBe(DESCRIPTION_WRITTEN_BY);
    }
  });

  it("gives every change a requirement, named after its file and derived from its issue", () => {
    for (const { change } of changes) {
      const found = requirements.find(
        ({ requirement }) => requirement.id === change.requirementId,
      );
      expect(found, `requirement for ${change.id}`).toBeDefined();
    }
    for (const { file, requirement } of requirements) {
      expect(file).toBe(`${requirement.id}.json`);
      expect(requirement.derivedFrom.url).toBe(
        `https://github.com/MessagePack-CSharp/MessagePack-CSharp/issues/${requirement.id.replace("MP-", "")}`,
      );
      expect(requirement.derivedFrom.note).toMatch(
        /^Derived by the engine lane from the upstream issue text on \d{4}-\d{2}-\d{2}; not Tieto's requirements set\.$/,
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
    for (const { requirement } of requirements) {
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
