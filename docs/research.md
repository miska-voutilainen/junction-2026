# Research

What we checked before committing to the seven ideas, and the only figures our pitch, concept card and idea pages quote. Each figure names its sample and source; "checked" means we read the source's abstract ourselves, not only a summary of it.

We ran four research passes on Sat 14.11 (Gemini Deep Research): two looked for better ideas, one gathered evidence on how agent-written pull requests fail, and one attacked our concept the way a sceptical Tieto engineer or investor would. Outcome: no idea replaced, six sharpened ([decisions.md](decisions.md), 2026-11-14).

## How agent pull requests fail

| Figure | Sample | Source | Checked |
| --- | --- | --- | --- |
| Merged agent PRs need a follow-up fix at 1.62 times the odds of human PRs in the same repositories; 69.6% of those fixes come from the same agent | 6,774 merged agent PRs | Takerngsaksiri, Duong, Barnett, [arXiv:2609.26847](https://arxiv.org/abs/2609.26847) (2026) | Yes |
| Revert rates differ by agent: Codex 6.1%, Devin 14.5%, human baseline 11.5% | 37,623 PRs | Kraishan, [arXiv:2609.17598](https://arxiv.org/abs/2609.17598) (2026) | Yes |
| 36.4% of an AI reviewer's comments were accepted, 56.3% rejected (mostly false positives, redundant or out of scope) | 31,073 comments, 10,191 PRs, 239 repositories | Lin, Liang, Thongtanunam, Tantithamthavorn, [arXiv:2607.03316](https://arxiv.org/abs/2607.03316) (2026) | Yes |
| About 14% of human review comments address defects; most concern readability and design | 570 comments | Bacchelli and Bird, ICSE 2013 | Yes (well-known) |
| Developers with an AI assistant wrote less secure code and rated it more secure | 47 participants | Perry et al., ACM CCS 2023 | Yes (well-known) |

Not yet checked, so not quoted: AI review hints pull reviewers' attention to the flagged lines with no gain on severe defects (Tufano et al. 2025, 29 developers); fluent AI explanations raise trust without raising accuracy (Gao et al. 2026, 34 participants); 38% of rejected agent PRs were abandoned as too large to review (Ehsani et al. 2026, 600 PRs).

## What it changed

- **An agent can write a test that encodes its own bug.** The failure-mode research calls it "double confirmation": the same agent writes the code and its test, and both carry the same mistake. So a PR's own test makes a claim Supported at most; only a test written from the requirement, without seeing the diff, makes it Verified ([spec](spec.md), A5).
- **AI reviewers are rejected for noise.** The precision of findings sits next to the catch rate on the report card, and a refusal must cite a rule that exists in our policy.
- **Some escalations shouldn't depend on the model.** Changes to the declared public API (`PublicAPI.Unshipped.txt`, the public attributes) always produce a refusal from a fixed rule.

## Ideas borrowed from other fields

Older disciplines solved "trusting work you didn't do and can't fully inspect" long before code review did. Three of our ideas turn out to be their methods:

| Our idea | Borrowed from | What we took |
| --- | --- | --- |
| Trust ladder | Continuous sampling plans (Dodge, 1943; Dodge and Torrey, 1951), used in manufacturing inspection | Clearance after consecutive clean checks; after a defect gets through, full inspection again ("cluster arrest", `R-escape`) |
| Quote check | Admissibility of expert evidence (Daubert v. Merrell Dow, 1993; Federal Rule of Evidence 702) | A claim reaches the human only if it fits the record: its quotes match the code, its rule exists. Struck claims stay in the log |
| Blind-first review | Preregistration in science (Registered Reports, Chambers 2013) | Expectations are written from the requirement before the reviewer reads the author's story |

Recommended but not built ("Beyond the reference" in the concept card): registered pull requests, where the owner signs the tests before the agent writes code; audit sampling (ISA 530) for very large PRs; round-trip property tests for serializers.

## Where the receipt fits in regulated delivery

Tieto's customers are banks, insurers, healthcare and the public sector, so we asked what their rules require of software changes. Two findings shape how we talk about the receipt:

- **No rule exempts AI-written code.** Change control, review and testing duties apply whoever or whatever wrote the change, and accountability stays with a named person in the organisation.
- **Auditors already ask for the record the receipt is.** Change-control frameworks want each change tied to who approved it, what was checked and what risk was accepted, with the approver separate from whoever implemented the change. With an agent as the author, the named signer is that separate approver.

| Control | What it asks | Status |
| --- | --- | --- |
| PCI DSS v4.0.1, requirement 6.2.3.1 | Manual code review by someone other than the author who knows review techniques, approved before release | Known, correct |
| DORA's rules on ICT change management and development (the ICT risk RTS, Delegated Regulation (EU) 2024/1774) | Controlled change management with approval separate from implementation, and source code review | Not checked: the EUR-Lex text couldn't be retrieved. Quote only as "DORA's rules on ICT change management", without article numbers |
| NIS2, Directive (EU) 2022/2555, art. 21(2)(e) | Security in the acquisition, development and maintenance of systems | Known, correct |
| Cyber Resilience Act, Regulation (EU) 2024/2847 | Reporting duties from 11 September 2026, full application from 11 December 2027 | Known, correct |
| EU AI Act, Regulation (EU) 2024/1689, art. 14 | Human oversight of high-risk AI systems; applies only where the software itself is high-risk AI | Known, correct |
| NIST SSDF, SP 800-218 (PW.7 review, PW.8 test) | Review and test code before release; SP 800-218A covers building AI models, not reviewing AI-written code | Known, correct |

**What the receipt is not:** it doesn't replace runtime or penetration testing, a software bill of materials, incident reporting, key governance (personal SSH keys would give way to the organisation's signing setup), or the separate approval to deploy to production. It is the change-approval record, nothing more.

**How we say it:** "the receipt is the kind of change-approval record auditors already ask for, now for agent-written changes". Never "compliant with" a regulation: the spec rules out legal claims, and compliance is decided per organisation.

**Tieto's own words.** Writing about AI agents chained together, Tieto said: "Organizations must define how risks are managed, how production use is monitored, how wrong or non-optimal use is tracked, who makes decisions, and when human oversight is required." The same article warns that without a shared governance model, isolated initiatives "can quickly lead to unmanageable, fragmented chaos." (Jutta Karjalainen and Kyösti Laiho, ["AI is not a quick win: Why AI winners act now, not tomorrow"](https://www.tietoevry.com/en/blog/2025/12/ai-is-not-a-quick-win-why-ai-winners-act-now-not-tomorrow/), Tieto, 29 December 2025; checked word for word.) Countersign answers that list for agent-written code: the refusal policy says who decides, the routing says when a human looks, and the report card tracks wrong output.

Not quoted: the company figures the research cited (training completion, headcount) are unchecked.

## The hardest questions, and our answers

1. **"Verified hunks can still hide a security flaw."** Verified only means a test written from the requirement fails before the change and passes after it. Refusal rules run on every hunk and send security, public API and dependency changes to a human regardless.
2. **"Doesn't a build error look like a failing test?"** No. We run each test on the base and on the head version of the whole change, not on single reverted hunks, and a build error is logged and never counts as evidence.
3. **"Four changes prove nothing statistically."** They don't, and we don't claim it. They show the mechanism. The numbers come from the planted-bug set, shown with their sample size, and the ladder keeps an area in Shadow until there's enough evidence.
4. **"Git notes are invisible and break on squash."** The receipt binds the diff, not the commit, so a squash with the same diff keeps it valid. In a real team the verify command's exit code is the merge check; our reference runs it from the command line.
5. **"Why isn't this a weekend feature for an existing review bot?"** Review bots add comments. We remove reading, and the signature records which hunks a named person read and which checks covered the rest.
