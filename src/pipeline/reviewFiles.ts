import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ZodType } from "zod";
import {
  ChangeInputSchema,
  RequirementSchema,
  ReportCardSchema,
  ReviewSchema,
  type ChangeInput,
  type ReportCard,
  type Requirement,
  type Review,
} from "../contracts";

/** Where the pipeline reads and writes, relative to the repository root where the CLI runs. */
const SAMPLE_CHANGES = path.join("data", "sample", "changes");
const SAMPLE_REQUIREMENTS = path.join("data", "sample", "requirements");
const RUNS = path.join("data", "runs");
const REPORT_CARD = path.join("data", "eval", "report-card.json");
const DATA_ROOT = path.resolve("data");

// Ids come from the command line and from data files and are joined into
// paths. "mp-2283" and "R-2283" pass; "../../.ssh/id_ed25519" does not, so a
// mistyped or hostile id can't make the CLI read or write outside data/.
const ID_PATTERN = /^[A-Za-z0-9-]+$/;

/** The change input and its requirement. @throws with the file path when one is missing or invalid. */
export async function loadChangeAndRequirement(
  changeId: string,
): Promise<{ change: ChangeInput; requirement: Requirement }> {
  const change = await readJson(
    path.join(SAMPLE_CHANGES, `${checkedId(changeId)}.json`),
    ChangeInputSchema,
  );
  const requirement = await readJson(
    path.join(SAMPLE_REQUIREMENTS, `${checkedId(change.requirementId)}.json`),
    RequirementSchema,
  );
  return { change, requirement };
}

/** The report card the routing uses, or null before `pnpm evals` has written one. */
export async function loadReportCard(): Promise<ReportCard | null> {
  if (!existsSync(REPORT_CARD)) return null;
  return readJson(REPORT_CARD, ReportCardSchema);
}

/** The recorded review of a change. @throws with the command to create it when there is none. */
export async function loadRecordedReview(changeId: string): Promise<Review> {
  const file = reviewPath(changeId);
  if (!existsSync(file))
    throw new Error(`No recorded review for ${changeId}. Run pnpm review run ${changeId} first.`);
  return readJson(file, ReviewSchema);
}

/** Which comparison run a review is: data/runs/<changeId>/<mode>/<k>.json. */
export interface ComparisonRun {
  mode: "anchored" | "blind";
  k: number;
}

/**
 * Writes data/runs/<changeId>/review.json, or the comparison run's file when
 * `comparison` is given (2-space JSON, trailing newline), and returns its path.
 */
export async function writeRecordedReview(
  review: Review,
  comparison?: ComparisonRun,
): Promise<string> {
  const file = comparison
    ? path.join(RUNS, review.changeId, comparison.mode, `${comparison.k}.json`)
    : reviewPath(review.changeId);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(insideData(file), `${JSON.stringify(review, null, 2)}\n`);
  return file;
}

function reviewPath(changeId: string): string {
  return path.join(RUNS, checkedId(changeId), "review.json");
}

/** @throws when `id` could name anything but a file inside its data folder. */
function checkedId(id: string): string {
  if (!ID_PATTERN.test(id))
    throw new Error(`"${id}" is not a valid id: use letters, digits and dashes only, e.g. mp-2283.`);
  return id;
}

/** The file's absolute path. @throws when it resolves outside data/, whatever built it. */
function insideData(file: string): string {
  const resolved = path.resolve(file);
  if (!resolved.startsWith(DATA_ROOT + path.sep))
    throw new Error(`${file} is outside data/. The pipeline only reads and writes there.`);
  return resolved;
}

async function readJson<T>(file: string, schema: ZodType<T>): Promise<T> {
  const resolved = insideData(file);
  let text: string;
  try {
    text = await readFile(resolved, "utf8");
  } catch {
    throw new Error(`Cannot read ${file}. Check the change id; sample data lives in data/sample/.`);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `${file} is not valid JSON. Re-create it (pnpm review run <changeId>) or restore it from git.`,
    );
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success)
    throw new Error(`${file} does not match its contract: ${parsed.error.message}`);
  return parsed.data;
}
