/**
 * Data loaders: every page reads committed JSON through these functions.
 *
 * Each file is looked up under its recorded folder first (`data/sample`,
 * `data/runs`, `data/eval`, `data/receipts`) and then under `data/fixtures/`
 * with the same relative path, so the UI works before the first recording
 * exists. `source` tells the page which one it got, and a page shows the
 * "Showing mock data" banner when any result says "fixture" (spec 9.1, T06).
 * Server-only: this module reads the file system, never import it from a
 * client component.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";
import {
  type ChangeInput,
  ChangeInputSchema,
  type ReceiptRecord,
  ReceiptRecordSchema,
  type ReportCard,
  ReportCardSchema,
  type Review,
  ReviewSchema,
} from "@/contracts";

/** Outcome of one load: the data and where it came from, nothing on disk, or a file that failed validation. */
export type LoadResult<T> =
  | { status: "ok"; data: T; source: "recorded" | "fixture" }
  | { status: "missing" }
  | { status: "invalid"; error: string };

const defaultDataRoot = path.join(process.cwd(), "data");
const fixtureFolder = "fixtures";

// Ids reach these functions from URL params; this keeps them from walking out of data/.
const safeId = /^[A-Za-z0-9-]+$/;

/**
 * Reads and validates one file, or returns null when it does not exist.
 * @throws Error with the file path and the zod issues when the file is not valid JSON or fails the schema.
 */
async function readValidated<T>(file: string, schema: z.ZodType<T>): Promise<T | null> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${file} is not valid JSON.`);
  }
  const parsed = schema.safeParse(json);
  if (parsed.success) return parsed.data;
  const issues = parsed.error.issues
    // Zod messages sometimes end in a period already; strip it so the join doesn't write "..".
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message.replace(/\.$/, "")}`)
    .join(". ");
  throw new Error(`${file} does not match its schema. ${issues}.`);
}

/** Recorded file first, then the fixture with the same relative path. */
async function loadFile<T>(
  relativePath: string,
  schema: z.ZodType<T>,
  root: string,
): Promise<LoadResult<T>> {
  try {
    const recorded = await readValidated(path.join(root, relativePath), schema);
    if (recorded !== null) return { status: "ok", data: recorded, source: "recorded" };
    const fixture = await readValidated(path.join(root, fixtureFolder, relativePath), schema);
    if (fixture !== null) return { status: "ok", data: fixture, source: "fixture" };
    return { status: "missing" };
  } catch (error) {
    return { status: "invalid", error: (error as Error).message };
  }
}

function loadById<T>(
  id: string,
  relativePath: (id: string) => string,
  schema: z.ZodType<T>,
  root: string,
): Promise<LoadResult<T>> {
  if (!safeId.test(id)) return Promise.resolve({ status: "missing" });
  return loadFile(relativePath(id), schema, root);
}

async function listJson(directory: string): Promise<string[]> {
  try {
    const names = await readdir(directory);
    return names.filter((name) => name.endsWith(".json")).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

/**
 * The Tieto changes for the inbox, sorted by id.
 *
 * Uses the recorded `data/sample/changes/` when it holds files and the fixtures
 * otherwise; the two folders are never mixed, so a half-recorded set can't
 * show a fixture change next to a real one. Planted-bug and contradiction-plant
 * inputs live in the same folder and are filtered out.
 */
export async function loadChanges(root: string = defaultDataRoot): Promise<LoadResult<ChangeInput[]>> {
  const recordedDirectory = path.join(root, "sample", "changes");
  try {
    let directory = recordedDirectory;
    let source: "recorded" | "fixture" = "recorded";
    let names = await listJson(directory);
    if (names.length === 0) {
      directory = path.join(root, fixtureFolder, "sample", "changes");
      source = "fixture";
      names = await listJson(directory);
    }
    if (names.length === 0) return { status: "missing" };
    const inputs: ChangeInput[] = [];
    for (const name of names) {
      const input = await readValidated(path.join(directory, name), ChangeInputSchema);
      if (input !== null && input.kind === "tieto") inputs.push(input);
    }
    inputs.sort((a, b) => a.id.localeCompare(b.id));
    return { status: "ok", data: inputs, source };
  } catch (error) {
    return { status: "invalid", error: (error as Error).message };
  }
}

/** One change input by id, e.g. `loadChange("mp-2283")`. */
export function loadChange(id: string, root: string = defaultDataRoot): Promise<LoadResult<ChangeInput>> {
  return loadById(id, (changeId) => `sample/changes/${changeId}.json`, ChangeInputSchema, root);
}

/** The recorded blind-first review of a change. */
export function loadReview(changeId: string, root: string = defaultDataRoot): Promise<LoadResult<Review>> {
  return loadById(changeId, (id) => `runs/${id}/review.json`, ReviewSchema, root);
}

/** The reviewer report card with the per-area trust levels. */
export function loadReportCard(root: string = defaultDataRoot): Promise<LoadResult<ReportCard>> {
  return loadFile("eval/report-card.json", ReportCardSchema, root);
}

/**
 * The receipt file's exact text, recorded file first and then the fixture, or null when neither exists.
 * "Copy JSON" on the receipt page copies this, so the copy is byte-for-byte what is in git.
 */
export async function loadReceiptText(changeId: string, root: string = defaultDataRoot): Promise<string | null> {
  if (!safeId.test(changeId)) return null;
  for (const folder of ["", fixtureFolder]) {
    try {
      return await readFile(path.join(root, folder, "receipts", `${changeId}.json`), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return null;
}

/** The exported signed receipt of a change; "missing" means nobody has signed it. */
export function loadReceipt(changeId: string, root: string = defaultDataRoot): Promise<LoadResult<ReceiptRecord>> {
  return loadById(changeId, (id) => `receipts/${id}.json`, ReceiptRecordSchema, root);
}
