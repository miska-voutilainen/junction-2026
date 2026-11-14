import { z } from "zod";

/** Review area. Used by data/runs/<changeId>/review.json and data/eval/report-card.json (producer: engine). */
export const AreaSchema = z.enum(["generator", "analyzer", "security", "performance"]);
export type Area = z.infer<typeof AreaSchema>;

/** How strongly a claim is backed (data/runs/<changeId>/review.json, producer: engine). */
export const EvidenceLevelSchema = z.enum(["verified", "supported", "unverified", "refused"]);
export type EvidenceLevel = z.infer<typeof EvidenceLevelSchema>;

/**
 * Per-hunk review coverage, part of TierDecision (producer: engine, route()).
 * "generated" marks hunks in generated files (snapshots): visible, but left out of the reading count.
 */
export const CoverageSchema = z.enum(["verified", "supported", "read", "generated"]);
export type Coverage = z.infer<typeof CoverageSchema>;

/** Review tier, part of TierDecision (producer: engine, route()). */
export const TierSchema = z.enum(["light", "focused", "full"]);
export type Tier = z.infer<typeof TierSchema>;

/** Trust level per area, data/eval/report-card.json (producer: engine, ladderLevel()). */
export const LadderLevelSchema = z.enum(["shadow", "calibrated", "trusted"]);
export type LadderLevel = z.infer<typeof LadderLevelSchema>;

/** Kind of a changed file, data/runs/<changeId>/review.json (producer: engine). */
export const FileKindSchema = z.enum(["source", "test", "docs", "generated"]);
export type FileKind = z.infer<typeof FileKindSchema>;

/** Full 40-character lowercase hex git SHA. */
export const ShaSchema = z.string().regex(/^[0-9a-f]{40}$/);

/** ISO 8601 timestamp with offset or Z. */
export const IsoTimestampSchema = z.iso.datetime({ offset: true });

/** Quoted source location, data/runs/<changeId>/review.json (producer: engine). Lines are 1-based and inclusive. */
export const CitationSchema = z.strictObject({
  file: z.string(),
  side: z.enum(["new", "old"]),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  quote: z.string(),
});
export type Citation = z.infer<typeof CitationSchema>;

/** Who checked a receipt item. Shared by Review.receiptDraft and Receipt (producers: engine, evidence). */
export const CheckedBySchema = z.enum(["tool", "ai-supported", "human"]);

/** The checked, notChecked and residualRisk block of a receipt draft and a signed receipt. */
export const ReceiptBodySchema = z.strictObject({
  checked: z.array(z.strictObject({ item: z.string(), by: CheckedBySchema })),
  notChecked: z.array(z.strictObject({ item: z.string(), reason: z.string() })),
  residualRisk: z.strictObject({
    text: z.string(),
    acceptedRefusalIds: z.array(z.string()),
  }),
});

/** UI labels for Tier. */
export const tierLabel: Record<Tier, string> = {
  light: "Light",
  focused: "Focused",
  full: "Full",
};

/** UI labels for Coverage. */
export const coverageLabel: Record<Coverage, string> = {
  verified: "Verified",
  supported: "Supported",
  read: "Read this",
  generated: "Generated",
};

/** UI labels for EvidenceLevel. */
export const evidenceLevelLabel: Record<EvidenceLevel, string> = {
  verified: "Verified",
  supported: "Supported",
  unverified: "Unverified",
  refused: "Refused",
};

/** UI labels for LadderLevel. */
export const ladderLevelLabel: Record<LadderLevel, string> = {
  shadow: "Shadow",
  calibrated: "Calibrated",
  trusted: "Trusted",
};

/** UI labels for Area. */
export const areaLabel: Record<Area, string> = {
  generator: "Generator",
  analyzer: "Analyzer",
  security: "Security",
  performance: "Performance",
};
