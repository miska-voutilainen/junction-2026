import { z } from "zod";
import { CoverageSchema, IsoTimestampSchema, ReceiptBodySchema, ShaSchema } from "./common";

/** The signed payload of a receipt; the draft lives in .scratch/receipts/<changeId>.json (producer: evidence lane). */
export const ReceiptSchema = z.strictObject({
  kind: z.literal("countersign-receipt"),
  version: z.literal(1),
  changeId: z.string(),
  requirementId: z.string(),
  repo: z.string(),
  commit: ShaSchema, // headSha
  baseCommit: ShaSchema,
  /** Tree SHA of the base commit; binds content, not history. */
  baseTree: ShaSchema,
  /** Tree SHA of the head commit; binds content, not history. */
  headTree: ShaSchema,
  diffSha256: z.string().regex(/^[0-9a-f]{64}$/),
  reviewerVersion: z.string(),
  reviewRunId: z.string(),
  owner: z.string(), // GitHub login, the allowed_signers principal
  signedAt: IsoTimestampSchema,
  ...ReceiptBodySchema.shape,
  /**
   * The hunk ledger, from `review.routing.coverage` at draft time. It sits
   * inside the signed payload, so the signature covers which hunks the owner
   * read and which checks covered the rest. `readBy` is the owner for read
   * hunks, else null.
   */
  hunks: z.array(
    z.strictObject({
      hunkId: z.string(),
      file: z.string(),
      coverage: CoverageSchema,
      readBy: z.string().nullable(),
    }),
  ),
});
export type Receipt = z.infer<typeof ReceiptSchema>;

/** data/receipts/<changeId>.json (producer: evidence lane). */
export const ReceiptRecordSchema = z.strictObject({
  schemaVersion: z.literal(1),
  changeId: z.string(),
  receipt: ReceiptSchema,
  signature: z.string(), // armored SSH signature
  notesRef: z.literal("refs/notes/countersign"),
  verify: z.strictObject({
    command: z.string(),
    output: z.string(),
    ok: z.boolean(),
    verifiedAt: IsoTimestampSchema,
  }),
});
export type ReceiptRecord = z.infer<typeof ReceiptRecordSchema>;
