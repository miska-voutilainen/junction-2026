/**
 * The trust ladder closes its loop here: once the eval has measured each
 * area's catch rate, every Tieto review is routed again with the earned levels,
 * and its receipt draft is rebuilt so "not checked" lists the hunks routing now
 * says a person reads. Spec section 5 (pnpm evals) and 9.1 (T16).
 */
import {
  ReviewSchema,
  type Area,
  type LadderLevel,
  type ReportCard,
  type Review,
} from "../../contracts";
import { route } from "../../rules/route";
import { buildReceiptDraft } from "../buildReceiptDraft";

/** The review with its routing and receipt draft recomputed for these levels; nothing else changes. */
export function rerouteReview(review: Review, levels: Record<Area, LadderLevel>): Review {
  const routing = route(review, levels);
  const receiptDraft = buildReceiptDraft({ ...review, routing }, levels);
  return ReviewSchema.parse({ ...review, routing, receiptDraft });
}

/** What the routing spread reports over the Tieto changes: tiers, hunks to read and minutes. Zeros for none. */
export function routingSpreadOf(reviews: readonly Review[]): ReportCard["routingSpread"] {
  const countTier = (tier: Review["routing"]["tier"]) =>
    reviews.filter((review) => review.routing.tier === tier).length;
  const sum = (pick: (routing: Review["routing"]) => number) =>
    reviews.reduce((total, review) => total + pick(review.routing), 0);
  return {
    changes: reviews.length,
    light: countTier("light"),
    focused: countTier("focused"),
    full: countTier("full"),
    readHunks: sum((routing) => routing.readHunks),
    totalHunks: sum((routing) => routing.totalHunks),
    readMinutes: sum((routing) => routing.readMinutes),
    fullMinutes: sum((routing) => routing.fullMinutes),
  };
}
