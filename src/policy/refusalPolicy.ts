/**
 * The whole refusal policy a person reads: the rules the model may raise
 * (refusals.ts, R1 to R7) plus the rules only code raises (R8, legacy zones).
 * Split in two files on purpose: refusals.ts is part of the A3 prompt, so a
 * rule the model must never use lives outside it, and adding one leaves the
 * reviewer, its recordings and its planted-bug scores unchanged. Spec section 5, Policy.
 */
import { legacyRefusalRule } from "./legacy";
import { refusalRules, type RefusalRule } from "./refusals";

/** Version of the whole policy: v1 was R1 to R7; v2 adds the rule-only R8. Bump it when a rule changes meaning. */
export const refusalPolicyVersion = "v2";

/** Every refusal rule, in id order: the model's rules, then the rule-only ones. */
export const allRefusalRules: readonly RefusalRule[] = [...refusalRules, legacyRefusalRule];
