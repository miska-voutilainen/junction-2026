/**
 * Refusal policy: decisions the AI must hand to a named human instead of
 * judging. Each rule has a stable id, so a refusal in a review and a line in a
 * receipt point at the same words. Spec section 5, Policy.
 */

/** Version of the rule set; bump it when a rule changes meaning. */
export const refusalPolicyVersion = "v1";

/** One refusal rule: what the AI won't judge and who decides instead. */
export interface RefusalRule {
  id: string;
  title: string;
  decider: string;
}

/** R1 to R7, in id order. */
export const refusalRules: RefusalRule[] = [
  { id: "R1", title: "Requirement intent: whether the requested behaviour is right", decider: "product owner (the library maintainers)" },
  { id: "R2", title: "Security design: trust boundaries, untrusted-input handling, crypto, secrets", decider: "security owner" },
  { id: "R3", title: "Data handling: retention, personal data, legal", decider: "data protection owner" },
  { id: "R4", title: "Irreversible changes: wire-format or persisted-data changes old readers can't read, destructive migrations, data deletion", decider: "change owner" },
  { id: "R5", title: "New third-party dependencies and licences", decider: "tech lead" },
  { id: "R6", title: "Changes it can't trace to the requirement", decider: "change owner" },
  { id: "R7", title: "Public contract: new or changed public API, diagnostic IDs or documented behaviour", decider: "API owner (the maintainers)" },
];
