/**
 * Sample data check: every file under data/sample/ parses against its contract
 * in src/contracts/, every change has its requirement, and the one false
 * statement in mp-2283's description is recorded verbatim in the answer key
 * (spec section 9.1, T07). The planted-bug and contradiction-plant checks
 * (T08) read only the committed files, except the one test that looks the
 * planted lines up in the fork through git, which runs when SAMPLE_REPO_DIR
 * is set and is skipped with a message otherwise.
 */
import { execFileSync } from "node:child_process";
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
// Spec section 4: ten variants, six of mp-2283 and four of mp-2234; four generator, three analyzer, three security.
const EXPECTED_VARIANTS_BY_PARENT = { "mp-2283": 6, "mp-2234": 4 };
const EXPECTED_VARIANTS_BY_AREA = { generator: 4, analyzer: 3, security: 3 };
// Spec section 6: a catch counts when its cited lines come within 3 lines of the planted range.
const LINE_TOLERANCE = 3;
// Spec section 4: cp1 and cp2 point at mp-2283, cp3 at mp-2234, cp4 at mp-2129.
const EXPECTED_CONTRADICTION_PARENTS = {
  cp1: "mp-2283",
  cp2: "mp-2283",
  cp3: "mp-2234",
  cp4: "mp-2129",
};
const sampleRepoDir = process.env.SAMPLE_REPO_DIR;

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

  it("gives every planted bug and contradiction plant an answer key of the same kind", () => {
    const plants = changes.filter(({ change }) => change.kind !== "tieto");
    for (const { change } of plants) {
      const key = answerKeys.find(({ key }) => key.plantId === change.id)?.key;
      expect(key, `answer key for ${change.id}`).toBeDefined();
      expect(key?.changeId).toBe(change.id);
      expect(key?.kind).toBe(
        change.kind === "planted-bug" ? "planted-bug" : "contradiction",
      );
    }
  });

  it("has ten planted bugs: six of mp-2283, four of mp-2234, by area 4, 3 and 3", () => {
    const variants = changes
      .map(({ change }) => change)
      .filter((change) => change.kind === "planted-bug");
    expect(variants.map(({ id }) => id).sort()).toEqual(
      Array.from(
        { length: 10 },
        (_, index) => `v${String(index + 1).padStart(2, "0")}`,
      ),
    );
    const countBy = (values: (string | null)[]) =>
      values.reduce<Record<string, number>>((counts, value) => {
        counts[String(value)] = (counts[String(value)] ?? 0) + 1;
        return counts;
      }, {});
    expect(
      countBy(variants.map(({ parentChangeId }) => parentChangeId)),
    ).toEqual(EXPECTED_VARIANTS_BY_PARENT);
    const areas = variants.map(
      ({ id }) =>
        answerKeys.find(({ key }) => key.plantId === id)?.key.area ?? null,
    );
    expect(countBy(areas)).toEqual(EXPECTED_VARIANTS_BY_AREA);
  });

  it("gives each planted bug its parent's description, branch name and a head that differs from the base", () => {
    for (const { change } of changes.filter(
      ({ change }) => change.kind === "planted-bug",
    )) {
      const parent = changes.find(
        ({ change: other }) => other.id === change.parentChangeId,
      )?.change;
      expect(parent, `parent of ${change.id}`).toBeDefined();
      expect(change.authorDescription.text).toBe(
        parent?.authorDescription.text,
      );
      expect(change.requirementId).toBe(parent?.requirementId);
      expect(change.branch).toBe(`variant/${change.id}`);
      expect(change.baseSha).toBe(parent?.baseSha);
      expect(change.headSha).not.toBe(parent?.headSha);
    }
  });

  it("has four contradiction plants on the changes the spec names, each pointing at its parent's head", () => {
    const plants = changes
      .map(({ change }) => change)
      .filter((change) => change.kind === "contradiction-plant");
    expect(
      Object.fromEntries(
        plants.map(({ id, parentChangeId }) => [id, parentChangeId]),
      ),
    ).toEqual(EXPECTED_CONTRADICTION_PARENTS);
    for (const plant of plants) {
      const parent = changes.find(
        ({ change }) => change.id === plant.parentChangeId,
      )?.change;
      expect(plant.headSha).toBe(parent?.headSha);
      expect(plant.branch).toBe(parent?.branch);
    }
  });

  it("records each contradiction plant's false sentence verbatim, once, in its description", () => {
    for (const { change } of changes.filter(
      ({ change }) => change.kind === "contradiction-plant",
    )) {
      const key = answerKeys.find(({ key }) => key.plantId === change.id)?.key;
      const sentence = key?.defect ?? "";
      expect(sentence.length).toBeGreaterThan(0);
      expect(change.authorDescription.text.split(sentence)).toHaveLength(2);
      expect(key?.file).toBeNull();
      expect(key?.area).toBeNull();
    }
  });

  it("gives every planted bug a file, a line range and an area", () => {
    for (const { key } of answerKeys.filter(
      ({ key }) => key.kind === "planted-bug",
    )) {
      expect(key.file, key.plantId).not.toBeNull();
      expect(key.area, key.plantId).not.toBeNull();
      expect(key.startLine, key.plantId).not.toBeNull();
      expect(key.endLine ?? 0, key.plantId).toBeGreaterThanOrEqual(
        key.startLine ?? 1,
      );
    }
  });

  it.skipIf(!sampleRepoDir)(
    sampleRepoDir
      ? "finds each planted range in its variant's file, inside the diff against the base"
      : "finds each planted range in the fork (skipped: set SAMPLE_REPO_DIR to the fork's clone)",
    () => {
      const git = (...args: string[]) =>
        execFileSync("git", ["-C", sampleRepoDir ?? "", ...args], {
          encoding: "utf8",
          maxBuffer: 64 * 1024 * 1024,
        });
      for (const { change } of changes.filter(
        ({ change }) => change.kind === "planted-bug",
      )) {
        const key = answerKeys.find(
          ({ key }) => key.plantId === change.id,
        )?.key;
        const file = key?.file ?? "";
        const lineCount = git("show", `${change.headSha}:${file}`).split(
          "\n",
        ).length;
        expect(
          key?.endLine ?? 0,
          `${change.id} range inside ${file}`,
        ).toBeLessThanOrEqual(lineCount);

        const hunkRanges = git(
          "diff",
          "-U0",
          change.baseSha,
          change.headSha,
          "--",
          file,
        )
          .split("\n")
          .flatMap((line) => {
            const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
            if (!match) return [];
            const start = Number(match[1]);
            return [
              { start, end: start + Math.max(Number(match[2] ?? 1), 1) - 1 },
            ];
          });
        const isInsideDiff = hunkRanges.some(
          ({ start, end }) =>
            (key?.startLine ?? 0) <= end + LINE_TOLERANCE &&
            (key?.endLine ?? 0) >= start - LINE_TOLERANCE,
        );
        expect(
          isInsideDiff,
          `${change.id} range lies in the diff of ${file}`,
        ).toBe(true);
      }
    },
  );
});
