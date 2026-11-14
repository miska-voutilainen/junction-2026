/**
 * The Read step as data: the requirement-traced story, its claims grouped by
 * requirement item with each citation's quote-check verdict. Pure functions,
 * so what the story shows is unit-tested. Spec section 3, S2 sidebar.
 */
import type { Citation, Review } from "@/contracts";
import { splitCitations } from "../citationHighlights";
import type { CheckedCitation } from "../citationHighlights";
import { fileName } from "../reviewModel";
import { plural } from "./stepsModel";

type Claim = Review["claims"][number];
type Finding = Review["findings"][number];
type Retraction = Review["retractions"][number];

/** A claim as the story shows it: with the retraction that withdrew it, if any. */
export interface StoryClaim {
  claim: Claim;
  retraction: Retraction | null;
  /** Each citation with the quote check's verdict; a quote not found in the code is never shown. */
  citations: CheckedCitation[];
}

/** A finding with its citations checked the same way. */
export interface FindingView {
  finding: Finding;
  citations: CheckedCitation[];
}

/** The claims that trace to one requirement item, or to none. */
export interface ClaimGroup {
  /** "F1 · The source generator does not throw ...", or "Not traced to a requirement item". */
  heading: string;
  claims: StoryClaim[];
}

/** Everything the Read step shows. */
export interface Story {
  what: string;
  why: string;
  touches: Review["story"]["touches"];
  groups: ClaimGroup[];
  /** "Quote check: 9 of 10 quotes found in the code, 1 claim downgraded, 1 finding dropped.", or null when no quote was checked. */
  quoteCheckLine: string | null;
  defects: FindingView[];
}

const UNTRACED_HEADING = "Not traced to a requirement item";

/**
 * The requirement-traced story: what the change does and why, then its claims
 * grouped by the requirement item they serve, in the requirement's own order
 * (functional items, then non-functional) with the untraced claims last.
 */
export function buildStory(review: Review): Story {
  return {
    what: review.story.what,
    why: review.story.why,
    touches: review.story.touches,
    groups: groupClaims(review),
    quoteCheckLine: quoteCheckLine(review.quoteCheck),
    defects: findingViews(review, "defect"),
  };
}

function groupClaims(review: Review): ClaimGroup[] {
  const storyClaims: StoryClaim[] = review.claims.map((claim) => ({
    claim,
    retraction: review.retractions.find((retraction) => retraction.claimId === claim.id) ?? null,
    citations: splitCitations(review, claim.id, claim.citations),
  }));
  const items = [...review.requirement.functional, ...review.requirement.nonFunctional];
  const groups: ClaimGroup[] = items.map((item) => ({
    heading: `${item.id} · ${item.text}`,
    claims: storyClaims.filter(({ claim }) => claim.requirementItemId === item.id),
  }));
  // A claim naming an item the requirement doesn't have is as untraced as one naming none.
  const knownIds = new Set(items.map((item) => item.id));
  const untraced = storyClaims.filter(({ claim }) => claim.requirementItemId === null || !knownIds.has(claim.requirementItemId));
  return [...groups, { heading: UNTRACED_HEADING, claims: untraced }].filter((group) => group.claims.length > 0);
}

/** The findings of one kind, each with its citations checked. */
export function findingViews(review: Review, kind: Finding["kind"]): FindingView[] {
  return review.findings
    .filter((finding) => finding.kind === kind)
    .map((finding) => ({ finding, citations: splitCitations(review, finding.id, finding.citations) }));
}

/** A failed quote downgrades its claim or drops its finding; the two are counted apart. */
function quoteCheckLine({ checked, passed, downgraded, dropped }: Review["quoteCheck"]): string | null {
  if (checked === 0) return null;
  const base = `Quote check: ${passed} of ${checked} quotes found in the code`;
  const outcomes = [downgraded > 0 && plural(downgraded, "claim") + " downgraded", dropped > 0 && plural(dropped, "finding") + " dropped"].filter(Boolean);
  return outcomes.length === 0 ? `${base}.` : `${base}, ${outcomes.join(", ")}.`;
}

/** The "file:line" text of a citation: "TypeCollector.cs:737–740", or one line when it cites one. */
export function citationLabel(citation: Citation): string {
  const lines = citation.startLine === citation.endLine ? String(citation.startLine) : `${citation.startLine}–${citation.endLine}`;
  return `${fileName(citation.file)}:${lines}`;
}
