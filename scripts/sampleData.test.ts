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
  type AnswerKey,
  type ChangeInput,
} from "../src/contracts";
import { classifyFile } from "../src/policy/areas";

const SAMPLE_DIR = join(__dirname, "..", "data", "sample");
const TIETO_CHANGE_IDS = ["mp-2283", "mp-2234", "mp-2129", "mp-2297"];
// Spec 9.1 T07: a description is 80 to 200 words, so a reviewer can read it in seconds.
const TIETO_BASE_SHA = "32258fdbee4bcd653c79f51b4376b5103c6f4d27";
const DESCRIPTION_WRITTEN_BY =
  "engine lane (Miska), drafted by a Claude Sonnet builder without opening prompts, pipeline or review output";
const MIN_DESCRIPTION_WORDS = 80;
const MAX_DESCRIPTION_WORDS = 200;
const MAX_TITLE_LENGTH = 70;
// Spec section 4: ten variants, six of mp-2283 and four of mp-2234; four generator, three analyzer, three security.
const VARIANT_IDS = ["v01", "v02", "v03", "v04", "v05", "v06", "v07", "v08", "v09", "v10"];
const EXPECTED_VARIANTS_BY_PARENT = { "mp-2283": 6, "mp-2234": 4 };
const EXPECTED_VARIANTS_BY_AREA = { generator: 4, analyzer: 3, security: 3 };
// Spec section 6: a catch counts when its cited lines come within 3 lines of the planted range.
// The same distance keeps the plants away from the parent change's own edits (spec section 4).
const LINE_TOLERANCE = 3;
// Spec section 4: cp1 and cp2 point at mp-2283, cp3 at mp-2234, cp4 at mp-2129.
const EXPECTED_CONTRADICTION_PARENTS = {
  cp1: "mp-2283",
  cp2: "mp-2283",
  cp3: "mp-2234",
  cp4: "mp-2129",
};
const PLANT_WRITTEN_BY =
  "engine lane (Miska), written by an isolated Claude Sonnet subagent before any reviewer prompt existed; it never opened prompts, pipeline or review output";
// Each fork check starts dozens of git processes, which is slow on Windows.
const FORK_TEST_TIMEOUT_MS = 60_000;
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
const requirements = readJsonFiles("requirements").map(({ file, json }) => ({
  file,
  requirement: RequirementSchema.parse(json),
}));
const answerKeys = readJsonFiles("answer-key").map(({ file, json }) => ({
  file,
  key: AnswerKeySchema.parse(json),
}));

const variants = changes
  .map(({ change }) => change)
  .filter((change) => change.kind === "planted-bug");
const contradictionPlants = changes
  .map(({ change }) => change)
  .filter((change) => change.kind === "contradiction-plant");

/** The answer key of a plant; throws so a missing key fails the test that asked for it. */
function answerKeyFor(plantId: string): AnswerKey {
  const found = answerKeys.find(({ key }) => key.plantId === plantId);
  if (!found) {
    throw new Error(`No answer key for ${plantId}. Add data/sample/answer-key/${plantId}.json.`);
  }
  return found.key;
}

/** A change input by id; throws so a dangling parent fails loudly. */
function changeById(id: string): ChangeInput {
  const found = changes.find(({ change }) => change.id === id);
  if (!found) {
    throw new Error(`No change ${id}. Add data/sample/changes/${id}.json.`);
  }
  return found.change;
}

/** A line range on the new side of a diff, 1-based and inclusive. */
interface LineRange {
  start: number;
  end: number;
}

/** Runs git in the fork's clone; only called when SAMPLE_REPO_DIR is set. */
function git(...args: string[]): string {
  return execFileSync("git", ["-C", sampleRepoDir ?? "", ...args], {
    encoding: "utf8",
  });
}

/** Counts lines the way an editor does: a trailing newline does not start another line. */
function countLines(content: string): number {
  const lines = content.split("\n");
  return content.endsWith("\n") ? lines.length - 1 : lines.length;
}

/**
 * The new-side line ranges of one file's hunks between two commits. With -U0
 * a hunk lists only changed lines. A pure deletion has count 0 and leaves a
 * mark at the line before it, which is kept as a one-line range.
 */
function changedLines(from: string, to: string, file: string): LineRange[] {
  // "@@ -1198 +1198 @@" gives start 1198; "@@ -10,3 +10,5 @@" gives start 10, count 5. An omitted count means 1.
  const hunkHeader = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;
  const ranges: LineRange[] = [];
  for (const line of git("diff", "-U0", from, to, "--", file).split("\n")) {
    const match = hunkHeader.exec(line);
    if (!match) continue;
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    ranges.push({ start, end: start + Math.max(count, 1) - 1 });
  }
  return ranges;
}

/** Whether two line ranges come within `distance` lines of each other (0: they share a line). */
function overlaps(edit: LineRange, startLine: number, endLine: number, distance: number): boolean {
  return startLine <= edit.end + distance && endLine >= edit.start - distance;
}

describe("sample data", () => {
  it("has the four Tieto changes, each named after its file", () => {
    const tieto = changes.filter(({ change }) => change.kind === "tieto");
    expect(tieto.map(({ change }) => change.id).sort()).toEqual([...TIETO_CHANGE_IDS].sort());
    for (const { file, change } of changes) {
      expect(file).toBe(`${change.id}.json`);
    }
  });

  it("fixes the fields spec 9.1 sets for the four Tieto changes", () => {
    for (const { change } of changes.filter(({ change }) => change.kind === "tieto")) {
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
      const found = requirements.find(({ requirement }) => requirement.id === change.requirementId);
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
    const mp2283 = changes.find(({ change }) => change.id === "mp-2283")?.change;
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
    for (const { change } of changes.filter(({ change }) => change.kind !== "tieto")) {
      const key = answerKeyFor(change.id);
      expect(key.kind).toBe(change.kind === "planted-bug" ? "planted-bug" : "contradiction");
      // A contradiction is a sentence in a Tieto change's description, so its key names that change.
      expect(key.changeId).toBe(change.kind === "planted-bug" ? change.id : change.parentChangeId);
    }
  });

  it("has ten planted bugs: six of mp-2283, four of mp-2234, by area 4, 3 and 3", () => {
    expect(variants.map(({ id }) => id).sort()).toEqual([...VARIANT_IDS]);

    const byParent: Record<string, number> = {};
    const byArea: Record<string, number> = {};
    for (const variant of variants) {
      const parentId = String(variant.parentChangeId);
      byParent[parentId] = (byParent[parentId] ?? 0) + 1;
      const area = String(answerKeyFor(variant.id).area);
      byArea[area] = (byArea[area] ?? 0) + 1;
    }
    expect(byParent).toEqual(EXPECTED_VARIANTS_BY_PARENT);
    expect(byArea).toEqual(EXPECTED_VARIANTS_BY_AREA);
  });

  it("gives each planted bug the area of its file, by the same path rule routing uses", () => {
    for (const variant of variants) {
      const key = answerKeyFor(variant.id);
      if (key.file === null) {
        throw new Error(`${variant.id} has no file in its answer key.`);
      }
      expect(key.area, `${variant.id} in ${key.file}`).toBe(classifyFile(key.file).area);
    }
  });

  it("gives each planted bug its parent's description and a head that differs from the parent's", () => {
    for (const variant of variants) {
      const parent = changeById(String(variant.parentChangeId));
      expect(variant.authorDescription.text).toBe(parent.authorDescription.text);
      expect(variant.requirementId).toBe(parent.requirementId);
      expect(variant.branch).toBe(`variant/${variant.id}`);
      expect(variant.baseSha).toBe(parent.baseSha);
      expect(variant.headSha).not.toBe(parent.headSha);
    }
  });

  it("has four contradiction plants on the changes the spec names, each pointing at its parent's head", () => {
    const parentOf = Object.fromEntries(
      contradictionPlants.map(({ id, parentChangeId }) => [id, parentChangeId]),
    );
    expect(parentOf).toEqual(EXPECTED_CONTRADICTION_PARENTS);
    for (const plant of contradictionPlants) {
      const parent = changeById(String(plant.parentChangeId));
      expect(plant.headSha).toBe(parent.headSha);
      expect(plant.branch).toBe(parent.branch);
    }
  });

  it("records each contradiction plant's false sentence verbatim, once, in its description", () => {
    const cp0Sentence = answerKeyFor("cp0").defect;
    for (const plant of contradictionPlants) {
      const key = answerKeyFor(plant.id);
      expect(key.defect.length).toBeGreaterThan(0);
      expect(plant.authorDescription.text.split(key.defect)).toHaveLength(2);
      expect(plant.authorDescription.text).not.toContain(cp0Sentence);
      expect([key.file, key.area, key.startLine, key.endLine]).toEqual([null, null, null, null]);
    }
  });

  it("states who wrote each plant, exactly, and when", () => {
    const writtenAtValues = new Set<string>();
    for (const { key } of answerKeys.filter(({ key }) => key.plantId !== "cp0")) {
      expect(key.writtenBy, key.plantId).toBe(PLANT_WRITTEN_BY);
      writtenAtValues.add(key.writtenAt);
    }
    for (const plant of contradictionPlants) {
      expect(plant.authorDescription.writtenBy).toBe(PLANT_WRITTEN_BY);
    }
    // Each plant carries its own time, not a shared round value.
    expect(writtenAtValues.size).toBe(variants.length + contradictionPlants.length);
  });

  it("gives every planted bug a file, an area and a line range that starts at line 1 or later", () => {
    for (const variant of variants) {
      const key = answerKeyFor(variant.id);
      expect(key.file, variant.id).not.toBeNull();
      expect(key.area, variant.id).not.toBeNull();
      expect(key.startLine, variant.id).toBeGreaterThanOrEqual(1);
      expect(key.endLine, variant.id).toBeGreaterThanOrEqual(
        key.startLine ?? Number.POSITIVE_INFINITY,
      );
    }
  });

  describe.skipIf(!sampleRepoDir)(
    sampleRepoDir
      ? "in the fork"
      : "in the fork (skipped: set SAMPLE_REPO_DIR to the fork's clone)",
    () => {
      it(
        "keeps each variant to one commit on the base, with the parent's message, pushed to origin",
        () => {
          for (const variant of variants) {
            const parent = changeById(String(variant.parentChangeId));
            expect(
              git("rev-list", "--parents", "-n", "1", variant.headSha).trim(),
              `${variant.id} is one commit whose parent is the base`,
            ).toBe(`${variant.headSha} ${variant.baseSha}`);
            expect(git("log", "-1", "--format=%B", variant.headSha).trim()).toBe(
              git("log", "-1", "--format=%B", parent.headSha).trim(),
            );
            expect(
              git("rev-parse", `refs/remotes/origin/${variant.branch}`).trim(),
              `origin/${variant.branch}; run pnpm seed to fetch the fork's branches`,
            ).toBe(variant.headSha);
          }
        },
        FORK_TEST_TIMEOUT_MS,
      );

      it(
        "finds each planted range in its variant's file, on lines only the variant changes",
        () => {
          for (const variant of variants) {
            const parent = changeById(String(variant.parentChangeId));
            const key = answerKeyFor(variant.id);
            if (key.file === null || key.startLine === null || key.endLine === null) {
              throw new Error(`${variant.id} needs a file and a line range.`);
            }

            const { file, startLine, endLine } = key;
            const content = git("show", `${variant.headSha}:${file}`);
            expect(endLine, `${variant.id} range inside ${file}`).toBeLessThanOrEqual(
              countLines(content),
            );

            // Exact: the variant's own edit is what the range marks.
            const variantEdits = changedLines(parent.headSha, variant.headSha, file);
            expect(
              variantEdits.some((edit) => overlaps(edit, startLine, endLine, 0)),
              `${variant.id} range matches its edit`,
            ).toBe(true);

            // The parent's own edits must stay out of reach of a catch (spec section 4).
            const parentEdits = changedLines(variant.baseSha, parent.headSha, file);
            for (const edit of parentEdits) {
              expect(
                overlaps(edit, startLine, endLine, LINE_TOLERANCE),
                `${variant.id} range is more than ${LINE_TOLERANCE} lines from the parent's edit at ${edit.start}-${edit.end}`,
              ).toBe(false);
            }
          }
        },
        FORK_TEST_TIMEOUT_MS,
      );
    },
  );
});
