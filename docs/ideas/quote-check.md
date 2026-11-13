# Idea 4 · A mechanical quote check

Every claim the AI makes cites the code with a file, a line range and a quote, and plain code checks that the quote is really there before anyone sees the claim.

> Draft. The hallucination counts come from recorded runs and are "not measured yet".

## The problem

A model can describe code that doesn't exist: a function that isn't called, a check that isn't there, a line from a different version of the file. In a review that's worse than no review, because it reads as confident evidence. Asking the model to be careful doesn't help; checking its citations does, and the check doesn't need another model.

## How it works

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="img/quote-check-dark.svg">
  <img src="img/quote-check-light.svg" alt="A claim's citation and the cited lines are normalised, then the quote is searched for in the cited lines. Found: Supported. Not found: Unverified, shown without citations. Every failure is counted." width="880">
</picture>

1. **Claims must cite.** Each claim the reviewer writes carries citations: `file`, `side` (`new` for the head version, `old` for the base), `startLine`, `endLine` and the exact `quote`.
2. **Normalise both sides the same way.** Replace `\r\n` with `\n`, collapse every run of whitespace (newlines too) to one space, and trim. The match stays case-sensitive. Models often re-indent quoted code, and an exact match would count that as a hallucination when it isn't.
3. **Substring match in the cited lines.** A citation passes when its normalised quote is a substring of the normalised text of lines `startLine`–`endLine` on the cited side. A file missing on that side fails with "file not present on new" (or "old").
4. **Claims are downgraded, never hidden silently.**
   - At least one passing citation: the claim is **Supported**, and its failing citations are removed.
   - No passing citation: the claim becomes **Unverified** with no citations, and stays visible as such.
5. **Findings must pass too.** A finding (a defect, a missing piece, scope creep) with no passing citation is dropped. A finding that can't point at the code isn't shown to a person.
6. **Every failure is counted.** Each failing citation is recorded with the claim's id. The report card shows quotes checked, quote failures, claims downgraded and findings dropped: the reviewer's hallucination rate, measured on its own output.

## What we measured

Not measured yet. The report card will show "quote failures: x of n quotes checked" over all recorded runs. A unit test checks that a deliberately wrong quote is caught.

## How to adopt it

- **What you need:** structured model output (a schema with `file`, `side`, `startLine`, `endLine`, `quote` per citation) and access to both versions of each file.
- **What it costs:** no model calls. About fifty lines of string handling and its tests.
- **Smallest first step:** add the citation fields to your review prompt's output schema and log the failures before you hide anything. The failure count alone tells you how much of your current AI review is invented.

## Limits and failure modes

- **A real quote can support a wrong claim.** The check proves the code exists where the model says, not that the model understood it. That's why a passing quote earns Supported, and only a test earns Verified ([Idea 6](evidence-levels.md)).
- **Short quotes match too easily.** A quote like `return;` passes almost anywhere. A minimum quote length is a reasonable next rule; we haven't added it.
- **Whitespace normalisation can join tokens** across line breaks in rare cases. We accept that for code review; it would matter more for prose.

The failure modes we saw go in `docs/lessons.md`.

## In the code

- The quote check in `src/pipeline/`, run between the story step (A2) and the area review (A3) (T12, in progress)
- `src/contracts/common.ts`: the citation and evidence-level types (in progress)
- Shown on screen S2, the Story tab: each claim with its quoted code; and on S3 under hallucinations
