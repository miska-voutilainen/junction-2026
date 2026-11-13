# Challenge: Earned Trust in AI Code (Tieto)

Source: https://hackjunction.app/participate/45/challenges/351 (login required; copied verbatim by the team on 2026-11-13). Read-only reference: what we build is in [spec.md](spec.md).

## The Challenge

How does AI code review keep pace with AI-written code, while humans stay accountable for every change?

## Introduction

It is Friday afternoon. A pull request lands from an agent. Two hundred lines, and your name is on the approval. Usually you would open the diff and start digging. But what if the change opened with its own explanation? What it does, why it was made, what else it touches, and how sure the AI is about each part. Suddenly you are not hunting for problems. You are checking a story, and questioning the parts that do not add up.

Pick Earned Trust in AI Code, and help define how code explains itself now and in the future.

## Background

- Agent tokens passed human tokens in February 2026 and reached 7.3 trillion by August (OpenRouter data, a16z chart).
- Reviewing every change by hand does not scale, yet engineers need a sound basis to trust AI-reviewed code.

## The challenge

Design an AI code review concept, then show it works. Define the concept, principles, reference implementation and technology considerations, across frontend, backend and security.

Challenge the traditional model: is line-by-line review still the right way to ensure quality? Balance risk, hallucination, transparency, confidence and quality in AI review. The result is a reference implementation that illustrates the concept – it is not a product.

## What we expect from each team

- Define the concept: what your team recommends the "PR review" factory should follow.
- State its key principles, including how it balances risk, hallucination, transparency, confidence and quality.
- Illustrate it as a reference, on one sample agent-written change with its requirement ID.
- Show what the AI found, what it refused to decide, and why.
- Show how the evidence lets a named human accept the change without a full read.
- Name the failure modes you saw, and keep a short log of decisions.
- Use synthetic or cleared sample data only.

## Deliverables

- Concept card: recommendation, principles, trade-offs, limits
- Live walkthrough showing where the trust comes from
- Lessons log and a demo video/presentation

Out of scope: a finished product, model training and vendor selection.

Expected outcome: a concept with explicit trade-offs that humans can trust and be accountable for.

## Insight

AI reviews. Humans stay accountable. Trust is built on evidence a person can check and own, not on the AI being confident.

### How humans build trust they can stand behind

- A named engineer owns each change and signs off on it.
- The AI review is advice with evidence, never the approval itself.
- Evidence is traceable to a requirement, so the owner can check it quickly.
- Depth of human review follows risk: low-risk changes get light checks, high-risk ones get a full read.
- Humans spot-check the AI reviewer, and track what it misses.
- Trust is earned per area, from track record, and withdrawn after escapes.

### What the owner signs

- What was checked, and by whom or what
- What was not checked, and why
- The residual risk they accept

### What is not accepted

- "The AI said it was fine." An unowned merge.
- Confidence without evidence, or a risk score nobody can explain.

### What major vendors recommend

- Route human attention by risk; keep reviews fast and low-noise.
- Review with full repo context, and verify findings before posting.
- Measure outcomes (reverts, incidents), not review activity.

## Directions you may take

Options, not requirements – every option keeps a named human accountable for the outcome.

- **Generalist reviewer:** one reviewer that covers frontend, backend, security and performance. How to train or prompt for that breadth is part of the work.
- **Classifier:** flag code that genuinely needs human review, and separate it from code that meets the standard.

## Questions judges will ask

- What would make you not trust your own output?
- Who owns the decision?
- How would this scale?

## Resources (what Tieto brings)

- Background on what good code means at Tieto: standards, security and quality
- A requirements set: intent, functional and non-functional
- Sample agent-written changes, each with its requirement ID

## Model access

Models from other Junction partners through partner credits on the Junction Platform. Connect any of these models to your concept.
