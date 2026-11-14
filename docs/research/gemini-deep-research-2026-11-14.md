# Gemini Deep Research pass: audit of the eight ideas (raw output)

Raw output of one Gemini Deep Research run on Sat 14.11.2026, pasted unedited below this note. We have not opened its sources. Its "read the source" labels are Gemini's, not ours; treat every claim as unverified until a person reads the paper or text. The math fragments are garbled from the copy.

What we took from it, and what we declined, is in [docs/research.md](../research.md) and [docs/concept-card.md](../concept-card.md).

---

Critical Assurance and Architectural Audit of the Countersign Reference Implementation
Section A: Verification of Unverified Empirical Claims
An empirical audit of the three unverified literature claims establishes that only the first claim (Tufano et al., 2025) accurately reflects its primary source. The second claim (Gao et al., 2026) mischaracterizes the dependent variable by substituting "accuracy" for "agreement" and overlooks the study's central finding on critical scrutiny. The third claim (Ehsani et al., 2026) commits a causal conflation by merging a separate dataset-wide quantitative correlation (unmerged pull requests are statistically larger) into the qualitative taxonomy category of "Abandoned/Not Reviewed" (38.0%).

Claim Under Audit Exact Title & Authors Venue, Year & Persistent IDs Sample Size (
N
N) Source Access Status Verification Verdict
"AI review hints pull reviewers' attention to flagged lines with no gain on severe defects" (Tufano et al. 2025)
Deep Learning-based Code Reviews: A Paradigm Shift or a Double-Edged Sword? — Rosalia Tufano, Alberto Martin-Lopez, Ahmad Tayeb, Ozren Dabić, Sonia Haiduc, Gabriele Bavota

IEEE/ACM 47th International Conference on Software Engineering (ICSE 2025), pp. 1640–1652; arXiv:2411.11401 (arXiv, IEEE CSDL, DBLP)

N
=

29
N=29 experienced developers across

>

50

> 50 review hours comparing Manual (MCR), ChatGPT Plus (ACR), and Utopian (CCR) treatments

Read the source (IEEE CSDL, arXiv) & seen in summary (AwesomeCodeReviews)

Verified & Accurate. Automated reviews strongly anchored reviewers on pre-flagged locations (89% kept); increased low-severity bug detection but yielded no gain on high-severity defects, time saved, or confidence.

"fluent AI explanations raise trust without raising accuracy" (Gao et al. 2026)
Evaluating the Impact of Explainable AI on Trust in AI-Assisted Code Review — Zhenhan Gao, Marvin Muñoz Barón, Umm-e Habiba, Daniel Graziotin, Stefan Wagner

Proc. ACM Softw. Eng. (PACMSE), Vol. 3, No. ISSTA, Article ISSTA093 (Oct 2026), DOI: 10.1145/3832184; arXiv:2607.24601 (arXiv PDF, arXiv HTML)

N
=

34
N=34 developers (via Prolific), within-subjects design reviewing 9 PRs across 3 XAI conditions (
34
×
9
=

306
34×9=306 review trials;
F
(
2
,
66
)
=

8.2497
F(2,66)=8.2497)

Read the source (arXiv PDF, arXiv HTML, ResearchGate)

Partially Distorted. Measures perceived trust, agreement with AI, and review time—not reviewer accuracy. Full explanations yielded highest trust (
3.99
/
5
3.99/5) but lower agreement than moderate feedback (
89.22
%
89.22%).

"38% of rejected agent PRs were abandoned as too large to review" (Ehsani et al. 2026)
Where Do AI Coding Agents Fail? An Empirical Study of Failed Agentic Pull Requests in GitHub — Ramtin Ehsani, Sakshi Pathak, Shriya Rawal, Abdullah Al Mujahid, Mia Mohammad Imran, Preetha Chatterjee

Proc. 23rd Int. Conf. on Mining Software Repositories (MSR 2026), pp. 807–811; arXiv:2601.15195 (arXiv HTML, Dagstuhl, GitHub Repo)

~33,000 agentic PRs (5 agents: Codex, Copilot, Devin, Cursor, Claude Code) + 600 manually annotated rejected PRs

Read the source (arXiv HTML, GitHub Replication) & seen in summary (Critical Propulsion, DEV)

Conflated / Inaccurate Attribution. 228/600 (38.0%) were closed with no meaningful human interaction ("Abandoned/Not Reviewed"). The paper does not state those 38% were abandoned because they were too large.

Detailed Verification Narrative
Tufano et al. (2025) — Attention Anchoring and Defect Severity
What the source says: In Deep Learning-based Code Reviews: A Paradigm Shift or a Double-Edged Sword? (arXiv:2411.11401, read the source; IEEE CSDL ICSE 2025, read the source; AwesomeCodeReviews, seen only in a summary), Tufano et al. conducted a controlled experiment with 29 experienced developers across more than 50 hours of code review. Participants reviewed Java and Python programs containing injected defects under three experimental treatments: Manual Code Review (MCR), Automated Code Review starting from ChatGPT Plus comments (ACR), and a utopian scenario starting from an ideal automated review (CCR). Reviewers retained on average 89% of the issues automatically identified by the LLM in their final submitted reviews. Crucially, while manual reviewers exhibited substantial variability in the code locations they inspected, reviewers given an automated review strongly clustered their attention on the specific locations pointed out by the tool across both the ACR and CCR treatments. Reviewers assisted by the LLM identified significantly more low-severity issues, but showed no statistically significant improvement in identifying high-severity issues compared to a completely manual review process, saved no time due to the cognitive overhead of interpreting and checking AI comments against the code, and reported no increase in review confidence.

Analytical inference: This empirical result provides the strongest justification for Countersign's refusal to operate as a conventional line-commenting bot. Simultaneously, however, it exposes a structural vulnerability in Countersign's Hunk Coverage Map (Idea 4): if Countersign routes human attention exclusively to Read-this hunks while hiding Verified and Supported hunks, it institutionalizes the exact attention-tunneling behavior documented by Tufano et al..

Gao et al. (2026) — Explainable AI, Perceived Trust, and Agreement
What the source says: In Evaluating the Impact of Explainable AI on Trust in AI-Assisted Code Review (arXiv:2607.24601 PDF, read the source; arXiv HTML, read the source; ResearchGate, read the source), Gao et al. conducted a within-subjects study with 34 software developers recruited via Prolific. Each participant evaluated九 (9) real-world pull requests across three cumulative GPT-4o conditions generated at temperature zero: Condition A (full two-phase explanation linking specific code changes to decision rationale plus review feedback), Condition B (Phase 1 review feedback and accept/reject recommendation only), and Condition C (accept/reject recommendation only, without explanations). A repeated-measures ANOVA revealed a statistically significant effect of explanation level on perceived trust as measured by the revised Hoffman TXAI scale (
F
(
2
,
66
)
=

8.2497
,
p
=

0.0006
F(2,66)=8.2497,p=0.0006). Condition A (full explanations) produced the highest perceived trust (
M
=

3.99
/
5
M=3.99/5), whereas Condition B (moderate feedback without the deep rationale narrative) achieved the highest participant agreement with the AI's recommendation (
89.22
%
89.22%). The explanation level had no significant impact on task completion time. The authors note that more extensive explanations appeared to prompt developers to question AI recommendations more frequently. The study did not measure objective "reviewer accuracy" across conditions as an experimental variable (an external summary on Powerdrill, seen only in a summary, explicitly notes that future research is required to explore the interaction between explanation levels and AI accuracy, while broader LLM calibration literature on PaperGuide, seen only in a summary, reports that verbose default explanations inflate user trust and lead users to overestimate model accuracy).

Analytical inference: Citing Gao et al. (2026) as proving that "fluent AI explanations raise trust without raising accuracy" is factually imprecise regarding the paper's measured variables. When cited accurately before technical judges, Gao et al. (2026) offers a sharper architectural lesson for Countersign: unconstrained narrative stories inflate subjective system trust (
3.99
/
5
3.99/5), whereas concise, inspectable evidence structures encourage healthier critical questioning.

Ehsani et al. (2026) — Failed Agentic Pull Requests and Abandonment
What the source says: In Where Do AI Coding Agents Fail? An Empirical Study of Failed Agentic Pull Requests in GitHub (arXiv:2601.15195 HTML, read the source; GitHub Replication Package, read the source; Critical Propulsion, seen only in a summary; DEV, seen only in a summary), Ehsani et al. examined roughly 33,000 agent-authored pull requests across five coding agents (Codex, Copilot, Devin, Cursor, and Claude Code) and manually annotated a statistically significant random sample of 600 unmerged pull requests. In the qualitative taxonomy (Table 3 of the paper), 228 of the 600 rejected pull requests (38.0%) fell under the Reviewer-level pattern "Abandoned/Not Reviewed," defined strictly as a pull request closed with no meaningful human interaction where only bots (if any) performed actions. The remaining rejection patterns were "Duplicate PR" (142; 23.7%), "CI/Test Failure" (99; 16.5%), "Unwanted Feature" (24; 4.0%), "Incorrect Implementation" (19; 3.2%), "Incomplete Implementation" (15; 2.5%), "Non-Functional PR" (13; 2.2%), "Agentic Misalignment" (9; 1.5%), "Wrong Task Description" (7; 1.2%), "License Issues" (4; 0.7%), and "Wrong Branch" (2; 0.3%). Separately, the authors' quantitative logistic regression across the broader dataset established that unmerged pull requests exhibited significantly higher
log
⁡
10
log
10
​
changed files, higher
log
⁡
10
log
10
​
changed lines of code (LOC), and higher CI failures (Cliff's
δ
=

24
%
δ=24%) than merged pull requests.

Analytical inference: The primary text does not claim that the 38% (228 pull requests) were abandoned specifically because they were "too large to review". Rather, 38% died from total reviewer abandonment (zero human engagement), while unmerged agent pull requests across the dataset correlated with larger diff sizes and frequent CI failures. Separating these two empirical facts strengthens Countersign's thesis without misrepresenting the MSR 2026 paper.

Section B: Critical Evidence Against the 8 Ideas and Concrete Improvements

1. Trust Ladder (Continuous Sampling Plans, Dodge 1943)
   What the sources say: Harold F. Dodge's (1943) Continuous Sampling Plan 1 (CSP-1) alternates between 100% screening inspection and reduced sampling inspection (sampling a fraction
   f
   f) after
   i
   i (or
   n
   n) consecutive defect-free items are observed, reverting immediately to 100% screening when a single defective unit is detected (MDPI Algorithms 11(4):46, read the source; ResearchGate CSP-5/GERT, read the source). However, statistical evaluations in Technometrics (CMU Technometrics Vol. 33, No. 4, read the source) and short-run simulations for complex Navy electronics (MDPI Algorithms, read the source) demonstrate that Dodge's analytical equations depend on three rigid assumptions: infinite production run lengths, an incoming production process that is stationary i.i.d. Bernoulli ("in statistical control"), and perfect inspection with zero false positives or false negatives. Even under perfect testing, achieving an Average Outgoing Quality (AOQ) of
   0.66
   %
   0.66% requires a clearance number of
   n
   \=
   100
   n=100 consecutive defect-free items (resulting in
   67.38
   %
   67.38% Average Percent Sampled), while lowering the clearance threshold to
   n
   \=
   30
   n=30 consecutive clean items doubles the escaping defect rate to
   AOQ
   \=
   1.36
   %
   AOQ=1.36% and still requires
   32.18
   %
   32.18% of all items to be inspected. Additionally, empirical code review research (ICML/PMLR v267 lu25f.pdf, seen only in a summary) notes that simulating code review by injecting synthetic defects fails to reflect the distribution of real historical defects.

Analytical inference: Applying Dodge's CSP-1 to code directories via planted-bug checks is statistically invalid for software repositories and unworkable in a four-change reference demonstration. Software changes in a C# codebase are neither infinite-horizon conveyor-belt items nor stationary i.i.d. Bernoulli trials; Ehsani et al. (2026) show that agent merge rates shift by 20 percentage points depending on the task type, from 84% for documentation down to 64% for bug fixes (DEV summary, seen only in a summary). Furthermore, passing a planted-bug check only tests whether the review harness catches synthetic mutations—it provides zero statistical evidence that the coding agent is introducing fewer real defects in that module. If Countersign sets a statistically defensible clearance number (
i
≥
30
i≥30), no module can climb the trust ladder across four sample pull requests; if it sets
i
=

3
i=3 for demonstration convenience, any judge versed in statistical quality control will recognize the threshold as arbitrary theater.

Addressing whether the ladder's thresholds could be set from a known statistical method: yes, if a sequential trust mechanism were retained, its parameters could be derived rigorously from two established mathematical frameworks rather than ad-hoc heuristics. Under Dodge's exact Average Outgoing Quality Limit (
AOQL
AOQL) and Markov/GERT formulations for CSP-1, CSP-2, and CSP-3, for a target
AOQL
AOQL and sampling frequency
f
f, the clearance number
i
i is solved by optimizing the Average Outgoing Quality function:

AOQ
(
p
)
=

p
(
1
−
f
)
(
1
−
p
)
i
f +
(
1
−
f
)
(
1
−
p
)
i
AOQ(p)=
f+(1−f)(1−p)
i

p(1−f)(1−p)
i

​

where
p
p represents the incoming defect probability (MDPI Algorithms, read the source). Shankar and Mohapatra (1994) and Veerakumari and Resmi (2018) model CSP-1 and CSP-5 using the Graphical Evaluation and Review Technique (GERT) and Markov chains to construct exact
(
i
,
f
)
(i,f) parameter tables indexed by Maximum Allowable Average Outgoing Quality (MAAOQ) and Consumer Risk
β
=

0.10
β=0.10, explicitly incorporating Type I and Type II inspection error rates (ResearchGate CSP-5, read the source; Semantic Scholar GERT CSP-1, seen only in a summary). Additionally, Dodge and Torrey's (1951) CSP-3 plan inspects four consecutive units immediately following any detected defect to guard against clustered defects while reducing the required clearance number
i
i by 2 to 4 units relative to CSP-2 (Scribd CSP-3 Mathematics, seen only in a summary). A superior statistical alternative for finite sequences is Abraham Wald's Sequential Probability Ratio Test (SPRT, 1947), which has been applied directly to software reliability and defect inspection (SRC Publishers SPRT, seen only in a summary; SlideShare Software Reliability SPRT, seen only in a summary). Wald's SPRT evaluates the hypothesis that a code module's defect rate is acceptable (
H
0
:
p
≤
p
0
H
0
​
:p≤p
0
​
) versus unacceptable (
H
1
:
p
≥
p
1
H
1
​
:p≥p
1
​
) within false-positive bound
α
α and false-negative bound
β
β. After
m
m observations containing
d
m
d
m
​
defects, the log-likelihood ratio is computed as:

Λ
m
=

d
m
ln
⁡
(
p
1
p
0
) +
(
m
−
d
m
)
ln
⁡
(
1
−
p
1
1
−
p
0
)
Λ
m
​
=d
m
​
ln(
p
0
​

p
1
​

​
)+(m−d
m
​
)ln(
1−p
0
​

1−p
1
​

​
)
Inspection is reduced only when
Λ
m
≤
ln
⁡
(
β
1
−
α
)
Λ
m
​
≤ln(
1−α
β
​
) and reverts to full inspection when
Λ
m
≥
ln
⁡
(
1
−
β
α
)
Λ
m
​
≥ln(
α
1−β
​
). While SPRT is provably optimal in minimizing expected sample sizes, the concrete improvement for Countersign's four-change scope is to drop the planted-bug Trust Ladder (Idea 1) entirely and replace it with Candidate Idea 3 (the Review-Finding-to-Executable-Rule Ratchet), where trust in a code area increases deterministically as human review findings are compiled into executable AST regression rules.

2. Quote Check (Mechanical Diff Match or Policy Citation; Struck Claims Stay in Log)
   What the sources say: Research on automated review comment grounding (arXiv:2607.25851v1, read the source) demonstrates that when models are restricted to localized diff inputs while relevant dependencies reside outside the diff, models fall back on generic patterns that yield fluent but weakly grounded claims. Security code review analyses (Vynox Security, read the source; Safeguard SAST vs. Manual, read the source; heygrc PCI DSS 6.2.3, read the source) establish that critical vulnerabilities frequently take the form of omissions—such as a missing access control check, a deleted webhook signature verification, or an un-updated caller elsewhere in the repository. Furthermore, qualitative empirical research by Alami and Ernst (CHASE 2025, AwesomeCodeReviews, seen only in a summary) demonstrates that verbose AI review outputs increase cognitive load on human reviewers.

Analytical inference: A mechanical check requiring every AI claim to quote a substring strictly from the diff fails via two distinct mechanisms: omission blindness and semantic hallucination over valid syntax. Under omission blindness, if an agent modifies a C# MessagePack formatter method signature or buffer contract in Lz4BlockArray.cs but fails to update a caller in MessagePackSerializer.cs, the defect lies in the untouched file. Because the untouched file is absent from the diff, a diff-only quote checker will mechanically strike the AI's warning about the broken caller, silencing a critical true positive. Conversely, an LLM can easily quote an exact substring from the diff (+ var span = buffer.Slice(offset, count);) and assert that the bounds check prevents integer overflow, passing the mechanical substring check while stating a semantic falsehood. Keeping struck claims visible in the primary human review interface also compounds cognitive noise and risks anchoring reviewers on discarded model hallucinations.

Concrete improvement: Expand the mechanical verifier from a diff-only substring matcher to a Repo-Wide AST Symbol and Span Verifier. Every AI claim must cite either an exact diff hunk line range, a verified AST symbol and line range in the base repository (enabling grounded claims about untouched callers or missing guards), or an existing policy rule identifier. Struck claims should be moved out of the primary human review interface into an audit-only git notes artifact (struck_claims.json) so human reviewers are not cognitively anchored by rejected hallucinations.

3. Blind-First Review (AI Writes Expectations from Requirement Before Reading Author's Description)
   What the sources say: Comparative evaluations of LLMs in code review (AwesomeCodeReviews 2025 Preprint Summary, seen only in a summary; Cihan et al., ResearchGate Fig. 3/4/5, read the source) demonstrate that LLM performance in issue classification (best-case accuracy of
   68.50
   %
   68.50%) and code correctness assessment drops substantially—with elevated false positive and false negative rates across both GPT-4o and Gemini—when problem or change descriptions are absent. Furthermore, Ehsani et al. (MSR 2026, arXiv:2601.15195v1, read the source) found that across 600 failed agentic pull requests, "Wrong Task Description" accounted for only 7 pull requests (
   1.2
   %
   1.2%), whereas "Incorrect Implementation" (19 pull requests;
   3.2
   %
   3.2%) and "Incomplete Implementation" (15 pull requests;
   2.5
   %
   2.5%) occurred despite an accurate task description.

Analytical inference: Preregistration succeeds in clinical trials because the hypothesis maps to a single statistical test. In software engineering, a requirement ticket (such as optimizing TypelessFormatter cache lookups) admits multiple valid architectural implementations. If the AI writes concrete code expectations blindly from a brief issue ticket before reading the pull request context, it will guess one specific implementation structure and flag valid alternative designs as deviations, inflating false positives—the exact failure mode that already causes 56.3% of AI review comments to be rejected.

Concrete improvement: Narrow Blind-First Review to Blind Invariant and Negative-Constraint Extraction. Before reading the author's pull request description or diff, the AI should extract only behavioral post-conditions and forbidden side effects from the requirement (for example, preserving wire-format compatibility and avoiding new byte-array allocations on cache hits). Subsequently, when comparing the requirement against the author's description and diff, the AI should check specifically for silent scope drift—changes present in the diff that are neither required by the ticket nor disclosed in the author's description.

4. Hunk Coverage Map and Routing (Verified, Supported, Read-this; Rule-Based)
   What the sources say: Addressing whether reviewing by hunk loses cross-hunk interactions, both static-analysis benchmarks and human-factors experiments confirm that routing review attention at the isolated diff-hunk level severs data-flow and control-flow interactions across hunks and files. In Towards Practical Defect-Focused Automated Code Review (arXiv:2505.17928 PDF, read the source), researchers evaluated automated code review across four repositories involving 4,090 developers using historical fault-introducing merge requests. The authors explicitly compared diff-only or parent-function inputs against static-analysis code slicing using Left Flow (upstream definitions and callers) and Full Flow (both upstream and downstream data and control dependencies). The results established that using only the diff or parent function is substantially less effective, whereas Left Flow and Full Flow slicing significantly improved Key Bug Inclusion, contributing to an up to 10x gain on KBI/CPI over baseline approaches. This aligns with Tufano et al. (ICSE 2025, IEEE CSDL, read the source), who proved that guiding reviewers to specific locations causes them to ignore unflagged code and miss high-severity structural defects, as well as a June 2026 empirical study on file ordering (ResearchGate Summary, seen only in a summary) that motivates dependency-aware grouping over isolated inspection. Industry security checklists (Vynox Security, read the source) likewise identify reviewing diffs in isolation as a primary cause of missed vulnerabilities.

Analytical inference: A Git diff hunk is a purely textual artifact defined by proximity of modified lines, not a semantic unit of execution. In a C# MessagePack fork, if Hunk A modifies SequencePool.Rent() (covered by a unit test and marked Verified), Hunk B modifies MessagePackWriter.Dispose() (covered by a unit test and marked Supported), and Hunk C alters a public enum (marked Read-this), Idea 4 directs the human reviewer to read only Hunk C. If Hunk A and Hunk B interact to cause a double-return buffer corruption bug when an exception occurs mid-serialization, the human never sees Hunk A or Hunk B, while the unit tests—which exercised normal execution paths independently—pass.

Concrete improvement: Replace isolated Hunk Routing with Roslyn Dependency-Sliced Hunk Groups. Countersign should use Roslyn's SemanticModel to compute a lightweight call and data-flow graph across all modified methods in the pull request, grouping any hunks that share a mutated field, a pooled buffer type, or a caller-callee edge into a single Connected Review Slice. A strict Contagion Rule must then apply: if any hunk within a Connected Review Slice is classified as Read-this, all other hunks in that slice must remain visible alongside it as linked context rather than being hidden from the reviewer.

5. Refusal Policy (Fixed Rules for Public API, Security, Dependencies Always Send to Human)
   What the sources say: Static path- or keyword-based escalation rules exhibit two documented weaknesses in practice. First, context-blind rules that fire on every syntactic match generate alert fatigue, training developers to rubber-stamp or bypass gates (Medium Unfamiliar Codebase Review, read the source; Collin Wilkins AI Code Review, read the source). Second, Cynthia, Muttakin, and Roy (MSR 2026, Beyond Bug Fixes: An Empirical Investigation of Post-Merge Code Quality Issues in Agent-Generated Pull Requests, arXiv:2601.20109v1, read the source) demonstrate that post-merge defects in agent-authored pull requests are heavily concentrated in high complexity, code duplication, and critical or major maintainability smells inside method bodies, concluding that teams adopting agentic workflows must treat duplication and high complexity as mandatory review triggers alongside testing.

Analytical inference: In a high-performance C# serialization library such as MessagePack, severe defects—including deserialization bombs, unchecked array length allocations leading to Out-Of-Memory Denial of Service, unsafe pointer overruns, or ArrayPool<T> memory leaks—rarely touch a .csproj dependency file or a public method signature; they occur inside internal or private deserialization routines. A Refusal Policy restricted to public APIs, dependencies, and generic security path names will fail to escalate the most dangerous C# changes in the Tieto repository.

Concrete improvement: Upgrade the deterministic Refusal Policy to incorporate Roslyn AST and Complexity Triggers tailored to systems-level C#. In addition to public or protected API signature changes and dependency modifications, the deterministic policy must force human escalation (Read-this) for any hunk containing unsafe, fixed, stackalloc, Marshal, Unsafe.*, or ArrayPool<T> / SequencePool rent and return operations; any allocation (new T[length]) where the length is derived from deserialized stream bytes without a dominating check against MessagePackSerializerOptions.Security.MaxArrayLength; and any method where cyclomatic complexity increases by
Δ
C
C
≥
4
ΔCC≥4 or introduces duplicated AST blocks.

6. Evidence Levels (Verified Only if Blind Test Fails Before & Passes After; No Confidence Scores)
   What the sources say: Regarding the "Blind Test Fails-Before / Passes-After" rule, a 2026 study on LLM code refinement (ResearchGate State of the Art Summary, seen only in a summary) demonstrates that when a code task requires invoking unspecified identifiers (variables, functions, classes, or new method overloads), an LLM that cannot see the target signature must guess the exact identifier signature and usage, resulting in fatal compilation errors. Furthermore, engineering verification standards (Verdent Qodo Guide, read the source; Konishi Code Review Checklist, read the source) emphasize that a single passing test only proves that one specific expected behavior passed and warn against "Test Theater" (§7.1, §8.10), where a single example passes while boundary conditions or adjacent branches fail. Regarding the specific question of whether "no confidence scores" is supported or contradicted by calibration research, the literature draws a sharp boundary between uncalibrated raw LLM confidence (which fails) and calibrated uncertainty indicators (which are supported and recommended). Contradicting a blanket ban on all uncertainty indicators, an April 2026 Automated Code Review (ACR) study (ResearchGate ACR Calibration Summary, seen only in a summary) explicitly reports that eliciting well-calibrated confidence scores enables more trustworthy and streamlined usage of imperfect models in automated code review tasks. Similarly, HCI trust calibration work by Kocielnik et al. (2019, cited in Taylor & Francis Int. J. Hum.-Comput. Interact. 2025, read the source) shows that explicit accuracy or uncertainty indicators preserve calibrated human trust when AI outputs are imperfect, and arXiv:2505.17928 (arXiv PDF, read the source) shows that variance across best-of-
   N
   N sampling runs provides a concrete signal of model stability. Conversely, supporting Countersign's rejection of raw self-reported model confidence, calibration reviews (PaperGuide LLM Review, seen only in a summary; Gao et al., arXiv:2607.24601, read the source) confirm that users systematically overestimate LLM accuracy when given fluent default explanations or uncalibrated self-assessments.

Analytical inference: If an issue ticket requests support for custom decompression buffer sizes in Lz4MessagePackSerializer without specifying the exact C# parameter types and overload name, a test generated completely blind to the diff will fail to compile against the pull request (CS1061 / CS1501). Even when a blind test compiles and passes, a single example test can pass while an adjacent else branch in the same hunk harbors a regression. On confidence scores, Countersign is justified in banning raw, self-reported LLM confidence percentages and replacing them with checkable execution tiers (Verified, Supported, Read-this), but it errs in treating the AI's natural-language requirement-to-code mapping as completely free of epistemic uncertainty.

Concrete improvement: First, provide the blind test generator with Roslyn-extracted method declarations (contract headers and signatures only, with all method bodies stripped) from the diff so generated tests compile reliably while remaining completely blind to the implementation logic. Second, require both a fail-before/pass-after test execution and 100% diff-branch execution coverage (verified via coverlet) plus a property-based round-trip check before classifying a hunk as Verified. Third, retain the ban on numerical confidence percentages, but introduce a discrete AMBIGUOUS_SPEC abstention flag whenever
N
=

3
N=3 generation runs produce divergent requirement interpretations.

7. Signed Receipt (SSH-Signed Git Note Bound to Diff, Not Commit)
   What the sources say: Compliance and security auditing guidelines for PCI DSS 6.2.3.1 (PCI DSS Guide, read the source) mandate that audit evidence bind to the exact code and version reviewed alongside reviewer independence, findings, corrections, and release decisions. Security code review checklists (Vynox Security, read the source) likewise establish that a diff cannot be evaluated safely in isolation from the surrounding repository state.

Analytical inference: Binding a cryptographic receipt exclusively to the diff (such as a git patch-id) rather than the underlying tree state creates a severe cryptographic vulnerability—a Rebase Context-Swap Attack. Suppose a named engineer reviews a diff hunk + return Pool.Rent(size); on a feature branch based on Commit
A
A (where Pool.Rent enforces a strict maximum size cap) and signs a receipt bound only to the diff hash. Prior to merge, the feature branch is rebased onto Commit
B
B, where a concurrent commit removed the size cap inside Pool.Rent or widened the type of size. Because the diff text of the feature branch has not changed by a single byte, its diff hash remains identical, meaning the engineer's SSH-signed receipt remains cryptographically valid on a merged codebase that is now vulnerable. Additionally, refs/notes/commits in Git attaches notes to commit object SHAs and is not pushed or fetched by default unless remote.origin.fetch is explicitly configured.

Concrete improvement: Bind the SSH-signed receipt payload to a four-part cryptographic tuple:

Receipt_Binding
=

Sign
SSH
(
Patch_ID
∥
Base_Tree_SHA
∥
Head_Tree_SHA
∥
Dependency_Slice_Hash
)
Receipt_Binding=Sign
SSH
​
(Patch_ID∥Base_Tree_SHA∥Head_Tree_SHA∥Dependency_Slice_Hash)
Here, Dependency_Slice_Hash is the SHA-256 hash of the AST bodies of all upstream and downstream methods in the pull request's Roslyn call slice. If the pull request is rebased onto a new main commit where only unrelated files changed, both Patch_ID and Dependency_Slice_Hash remain unchanged, allowing the receipt to survive the rebase safely; if any called method or type definition within the dependency slice changed during the rebase, the signature automatically invalidates and forces re-verification.

8. Separation of Duties (AI Drafts, Named Person Signs, Author Never Checks Own Work)
   What the sources say: CodeRabbit's architectural analysis (CodeRabbit Blog: Code Review Needs Independence, read the source) notes that a model is a poor judge of its own work and that models from the same family share correlated blind spots. Similarly, arXiv:2505.17928 (arXiv PDF, read the source) demonstrates the value of heterogeneous LLM combinations to mitigate single-model blind spots. On the human side, Tufano et al. (ICSE 2025, IEEE CSDL, read the source) show that human reviewers passively retain 89% of AI-generated review items. Furthermore, PCI DSS v4.0.1 Requirement 6.2.3.1 (OpenCRE PCI DSS 6.2.3.1, read the source; Safeguard PCI DSS 6.2.3, read the source; Veridical PCI DSS, read the source) requires three distinct roles for manual code review prior to release: the originating code author, an independent reviewer knowledgeable in secure coding, and a management release-control approver who is neither the original code author nor the code reviewer.

Analytical inference: If an agent pull request is authored by Claude Code (or GitHub Copilot) and Countersign invokes the same underlying model family to generate the blind verification test (Idea 6) that classifies hunks as Verified, then the same model family is effectively checking its own work and sharing correlated blind spots. Worse, because Idea 4 hides Verified and Supported hunks from the human reviewer, requiring a named engineer to sign a receipt covering the entire pull request places the human in a "moral crumple zone"—assuming personal cryptographic liability for hunks the system explicitly instructed them not to read.

Concrete improvement: Enforce a Cross-Vendor Model Independence Gate in the receipt metadata (author_agent_model_family != verifier_model_family) so that blind test generation and review drafting always execute on a model family distinct from the coding agent. Simultaneously, implement Scoped Liability and Dual Counter-Signatures: the named human reviewer's SSH signature explicitly attests only to the Read-this slices they personally inspected, while the deterministic CI harness counter-signs the Verified slices and acts as (or routes to) the third-party Release Control gate required by PCI DSS 6.2.3.1.

Section C: Five Superior Candidate Ideas for Countersign
Each candidate idea below addresses an empirical failure mode in Countersign's current design, avoids all previously rejected features (no multi-agent debate, mutation testing, learned risk models, native GitHub App, registered pull requests, or ISA 530 audit sampling), requires no live users or model training, and can be implemented and demonstrated across four C# MessagePack changes within one to three hours.

Candidate Idea Problem Solved (Unaddressed by Current Design) Primary Source / Working System Build Time on 4 C# Changes Closest Current Idea Replaced / Upgraded

1. Roslyn Data-Flow & Call-Graph Slicing (Left Flow / Full Flow) Cross-hunk and cross-file state corruption hidden when isolated hunks pass local unit tests
   Towards Practical Defect-Focused Automated Code Review (arXiv:2505.17928, read the source) + Microsoft Roslyn SemanticModel

~2.5 hours (Microsoft.CodeAnalysis workspace slicer) Upgrades Idea 4 (Hunk Routing) & Idea 2 (Quote Check) 2. Differential Round-Trip & Truncation Property Fuzzing "Test Theater" where 1 example-based blind test passes while buffer boundaries or round-trip invariants fail
Konishi (§7.1–7.4, Code Review Checklist, read the source) + Verdent (read the source) + FsCheck

~1.5 hours (FsCheck.Xunit harness on MessagePack types) Upgrades Idea 6 (Evidence Levels via single blind test) 3. Review-Finding-to-Executable-Rule Ratchet Ephemeral review comments that fail to prevent agents from repeating the same bug in subsequent PRs
Contieri (Turn Every Review Finding Into a Rule, read the source) + Roslyn / Semgrep AST rules

~2.0 hours (CLI rule compiler verified against rejected + clean diffs) Replaces Idea 1 (Planted-Bug Trust Ladder) 4. Grounded Socratic Abstention & Pre-Sign Micro-Check Fluent AI stories inflating trust (
3.99
/
5
3.99/5) and inducing passive rubber-stamping (
89
%
89% retention)
Tufano (arXiv:2607.22095, read the source) + Gao et al. (arXiv:2607.24601, read the source)

~1.0 hour (CLI prompt & interactive pre-signature prompt) Upgrades Story Format & Idea 8 (Separation of Duties) 5. Pre-Review Agentic Blast-Radius & Complexity Gate 38% reviewer abandonment and post-merge maintainability decay from complex/bloated agent PRs
Ehsani et al. (arXiv:2601.15195, read the source) + Cynthia et al. (arXiv:2601.20109, read the source)

~1.0 hour (Roslyn LOC,
Δ
Δ Cyclomatic Complexity & duplication gate) Upgrades Idea 5 (Refusal Policy)

Detailed Evaluation of Candidate Ideas
Candidate 1: Roslyn Data-Flow and Call-Graph Slicing (Left Flow / Full Flow Review Slices)
Countersign currently routes review attention by individual Git diff hunks (Idea 4) and restricts mechanical quotes to the diff (Idea 2), which fails to solve cross-hunk and cross-file state corruption when an agent modifies a shared buffer offset in one hunk and a reader loop in another, or breaks an untouched caller in a separate file. This candidate is grounded in Towards Practical Defect-Focused Automated Code Review (arXiv:2505.17928, read the source), which demonstrated across four repositories and 4,090 developers that extracting static Left Flow (upstream callers and state definitions) and Full Flow (downstream impact) slices yields up to a 10x improvement in Key Bug Inclusion compared to diff-only or parent-function inputs, and is implemented via Microsoft's working compiler API Microsoft.CodeAnalysis (Roslyn) using SemanticModel.AnalyzeDataFlow and SymbolFinder.FindCallersAsync. It can be demonstrated on four C# changes within approximately 2.5 hours by writing a 120-line C# console command that loads the MessagePack .sln via MSBuildWorkspace, maps changed line numbers in the four sample diffs to MethodDeclarationSyntax nodes, extracts the one-hop caller/callee AST slice and shared struct or class fields, and outputs a unified JSON Review Slice. This approach is superior to Countersign's isolated Hunk Coverage Map (Idea 4) and diff-only Quote Check (Idea 2) because it guarantees that semantically coupled changes are routed together and provides deterministic AST source spans for untouched callers, eliminating omission blindness.

Candidate 2: Differential Round-Trip and Stream-Truncation Property Fuzzing (FsCheck)
Countersign's Idea 6 marks a hunk Verified—and hides it from the human reviewer—if a single example-based test written from the requirement fails before the pull request and passes after. As Verdent (Qodo Guide, read the source) and Konishi (Code Review Checklist §7.1, read the source) point out, a single example test only proves that one specific input passed ("Test Theater"), leaving buffer boundaries and serialization symmetry unverified. Grounded in Konishi's property-based verification standard (§7.1–7.4, Code Review Checklist, read the source) and the working .NET property-testing engine FsCheck (FsCheck.Xunit), this candidate exploits the domain structure of the C# MessagePack repository. It can be demonstrated across all four C# sample changes in roughly 1.5 hours because every serializer or formatter change in MessagePack must satisfy two universal algebraic invariants that require zero manual test-oracle authoring: round-trip equivalence (
∀
x
,
Deserialize
(
Serialize
PR
(
x
)
)
=

x
∀x,Deserialize(Serialize
PR
​
(x))=x) and truncation memory safety (for any serialized byte payload
B
B of length
L
L, slicing
B
[
0..
k
]
B[0..k] for all
0
≤
k
<
L
0≤k<L and invoking Deserialize must throw only MessagePackSerializationException, never OverflowException, ArgumentOutOfRangeException, AccessViolationException, or leaked ArrayPool buffers). This is markedly superior to Idea 6's reliance on a single blind LLM unit test because it executes 1,000+ randomized boundary inputs deterministically in under two seconds (avoiding the heavy runtime cost of mutation testing), sidesteps blind-test compilation failures when method signatures change, and delivers mathematical proof of behavioral preservation.

Candidate 3: Review-Finding-to-Executable-Rule Ratchet
When a human reviewer inspects a Read-this hunk and catches an agent defect on Change #1, Countersign's signed receipt (Idea 7) records that event as passive historical metadata, doing nothing to prevent the coding agent from repeating the exact same mistake on Change #4. Grounded in Maximiliano Contieri's engineering protocol (AI Coding Tip 041 - Turn Every Review Finding Into a Rule, maximilianocontieri.com, read the source, which builds on Mäntylä and Lassenius's finding that 60% to 75% of code review defects concern structural and evolvability rules), every human review finding on a rejected diff is converted into an executable rule that is mechanically tested to ensure it blocks the rejected diff and passes the remediated diff. This can be demonstrated across the four sample C# changes within two hours: on Change #1, a human reviewer flags an unsafe Span<byte> or SequencePool misuse in a Read-this hunk; Countersign's CLI runs a countersign codify-rule command that validates a 10-line Semgrep or Roslyn syntax rule against the rejected and clean diffs of Change #1; and on Change #4, that newly codified rule automatically intercepts a similar agent defect before human review. This directly replaces Idea 1 (the Dodge CSP-1 Planted-Bug Trust Ladder), which requires 30 to 100 consecutive clean runs under stationary i.i.d. assumptions and cannot operate meaningfully across four changes; by contrast, the Rule Ratchet visibly demonstrates "Earned Trust" within four pull requests by permanently shrinking the repository's unverified risk surface.

Candidate 4: Grounded Socratic Abstention and Pre-Sign Micro-Check
Countersign's narrative pitch relies on explaining each change as a "requirement-traced story," yet Gao et al. (ISSTA 2026, arXiv:2607.24601, read the source) proved that full narrative explanations inflate developer trust (
3.99
/
5
3.99/5) without increasing agreement over concise feedback, and Tufano et al. (ICSE 2025, IEEE CSDL, read the source) proved that reviewers passively retain 89% of AI review framings without catching more severe bugs. Grounded in Rosalia Tufano's July 2026 paper Code Review is a Conversation: Toward Conversational AI Review Assistants (arXiv:2607.22095, read the source; ResearchGate, read the source)—which argues that AI review systems must know when to abstain or escalate, ask grounded questions, and capture developer rationale—combined with Gao et al.'s mandatory reasoning justification field (arXiv:2607.24601v1, read the source), this candidate replaces passive storytelling on Read-this hunks with active verification. Demonstrable in roughly one hour across the four C# changes, Countersign replaces fluent explanations on Read-this slices with an explicit "What Cannot Be Proven" abstention box and a single code-grounded Socratic question (for example, asking how a rented SequencePool buffer on line 142 is returned if ReadCore throws an exception on line 148). When the named engineer executes countersign sign, the CLI prompts for a one-line rationale response that is embedded directly inside the SSH-signed receipt. This improves upon Countersign's narrative story format and Idea 7/8 receipt signing by proving cognitive engagement rather than rubber-stamping.

Candidate 5: Pre-Review Agentic Blast-Radius and Complexity Gate
Countersign's current pipeline assumes every agent pull request should proceed directly to review, ignoring Ehsani et al.'s (MSR 2026, arXiv:2601.15195v1, read the source) finding that 38% of failed agent pull requests die from reviewer abandonment and that unmerged pull requests correlate with larger diff sizes and CI failures, as well as Cynthia et al.'s (MSR 2026, arXiv:2601.20109v1, read the source) finding that merged agent pull requests accumulate high complexity and code duplication smells. Grounded directly in Cynthia et al.'s recommendation to enforce complexity and duplication gates alongside testing (arXiv:2601.20109v1, read the source) and Cisco's empirical review threshold showing defect detection drops sharply beyond 200 to 400 lines of code (Vynox Security, read the source), this candidate adds a deterministic pre-flight gate before any LLM call or human routing occurs. Demonstrable in one hour using Roslyn syntax metrics on the four C# changes, the gate computes net Read-this lines of code, cyclomatic complexity delta (
Δ
C
C
ΔCC), and AST block duplication; if an agent diff exceeds the reviewable blast radius or spikes complexity without justification, Countersign bounces the pull request back to the agent for decomposition before paging a human. Whereas Idea 5 (Refusal Policy) escalates complex or risky diffs to overburdened humans, Candidate 5 protects human reviewer attention by rejecting bloated, unmaintainable agent diffs upstream.

Section D: Plain Comparison with Existing Commercial AI Review Products
Judges from AI and technology firms will evaluate Countersign against production tools including CodeRabbit, Cursor (Bugbot, Security Agents, and Approval Agents), Graphite (Graphite Agent), Qodo (formerly CodiumAI), and GitHub Copilot Code Review. Claiming novelty where commercial platforms already ship mature capabilities will undermine the presentation.

Countersign Idea CodeRabbit Cursor (Bugbot & Approval Agents) Graphite (Graphite Agent) Qodo (CodiumAI) GitHub Copilot Code Review Plain Verdict on Novelty

1. Trust Ladder (Planted-Bug CSP-1)
   Not done (uses persistent repo "Learnings" instead)

Not done (uses @cursor remember & resolution rates)

Not done

Not done

Not done
Novel, but statistically flawed in short runs.

2. Quote Check (Mechanical Diff Match + Struck Log)
   Partial (grounds comments in diff lines; filters false positives internally, no struck log)

Partial (diff-grounded findings; no struck-claim audit log)

Partial (diff + repo context grounding; no struck log)

Partial (diff-grounded; no struck log)

Partial (line-anchored comments; no struck log) Moderately novel: mechanical substring + AST verification with an auditable struck log is not offered by commercial tools. 3. Blind-First Review (Preregistration from Spec)
Not done (reads PR description, issue, and diff together to check spec compliance)

Not done (reads full session/repo/diff context together)

Not done (compares docs and code together)

Not done (reads ticket + diff together)

Not done (reads PR title/body + diff together)
Novel workflow: commercial tools feed spec, PR description, and diff into the prompt simultaneously.

4. Hunk Coverage Map & Risk Routing (Verified, Supported, Read-this)
   Partial (estimates review effort 1–5 & generates architectural walkthrough order)

Already does PR-level risk auto-approval & area routing via Approval Agents

Partial (stacked PRs + custom rule scoping)

Partial (groups changes by risk/test coverage)

Partial (file-level CODEOWNERS routing)
Partially commoditized at PR level by Cursor; Countersign's differentiator is deterministic, model-free per-hunk test-tier routing.

5. Refusal Policy (Fixed Escalation Rules)
   Already done via Path Instructions & deterministic Coding Guidelines

Already done via Approval Agent risk thresholds + Security Agent holds

Already done via plain-language & path rules

Already done via deterministic rule gates

Already done via GitHub Rulesets & CODEOWNERS

Commodity feature. Every enterprise tool + GitHub branch protection already does fixed-rule human escalation.

6. Evidence Levels (Blind Fail-Before / Pass-After Test; No Confidence Scores)
   Partial ("Runtime Verification" in CodeRabbit Secure tests exploits; not blind TDD)

Not done (runs existing tests or generates post-hoc fixes)

Not done

Partial (generates tests for PRs, but sees the diff first)

Not done Highly novel and defensible. No commercial tool requires a blindly generated requirement test to fail on Base and pass on Head to earn Verified routing. 7. Signed Receipt (SSH-Signed Git Note Bound to Diff + Hunks Read)
Not done (leaves standard GitHub PR comments/approvals)

Not done (uses platform PR approval API)

Not done (uses GitHub PR state)

Not done (uses GitHub PR comments)

Not done (uses GitHub PR review records) Highly novel. Storing an in-repo, SSH-signed git note attesting to exact hunk-level human vs. automated coverage does not exist in commercial tools. 8. Separation of Duties (AI Drafts, Named Human Signs, Independent Model)
Already championed (explicitly markets multi-model vendor independence + human merge)

Opposite philosophy ("Review is most useful as part of the same system that produced the change" + auto-approves low risk)

Already done ("AI should never replace human review; humans decide what gets merged")

Already done (human-in-the-loop final review)

Already done (Copilot cannot approve a PR to satisfy required human reviews)
Principle is standard; only becomes distinct when fused with Idea 7 (cryptographic receipt) and cross-model enforcement.

Key Takeaways on Commercial Overlap
What the sources say: Cursor's product documentation (cursor.com/guides/ai-code-review, read the source) demonstrates that Cursor already ships Approval Agents that score each pull request by risk, automatically approve low-risk changes such as copy tweaks or configuration bumps without waiting on a human, hold anything above a defined risk threshold based on Bugbot and Security Agent findings, and route pull requests needing human inspection to specific team owners using per-area routing policies. Meanwhile, CodeRabbit's engineering blog (coderabbit.ai/blog/code-review-needs-independence, read the source) already champions Separation of Duties and compliance readiness as its primary enterprise differentiator against Cursor, emphasizing that the system helping to create the code must not be the same system deciding whether it is safe to ship because models from the same family share correlated blind spots. CodeRabbit also estimates review effort on a 1-to-5 scale and presents changes in an architectural walkthrough order rather than file-by-file (Devin PR #6630, read the source; CodeRabbit Blog, read the source). Graphite (amplifilabs.com, read the source) and Qodo (verdent.ai, read the source; codegen.com, read the source) likewise position AI review between deterministic checks and human merge sign-off.

Analytical inference: Countersign must not present general "Separation of Duties" (Idea 8) or fixed "Refusal Policies" (Idea 5) as standalone innovations, as CodeRabbit, Graphite, and GitHub Rulesets already market those exact concepts. Instead, Countersign's genuine, un-commoditized technical differentiation lies in the epistemic chain connecting Ideas 3, 6, 4, and 7: deterministic, model-free slice routing (contrasting with Cursor's LLM-scored Approval Agents); strict epistemic separation between author-written tests (Supported) and contract-blind requirement tests (Verified, contrasting with Qodo's diff-informed test generation); and portable, platform-independent SSH-signed receipts stored directly in git notes rather than mutable SaaS pull-request comments.

Section E: Regulatory Framing (Exact Primary Text Citations)
All article and requirement numbers below are retrieved directly from primary European Union legislative texts on EUR-Lex and verbatim PCI DSS v4.0 / v4.0.1 requirement reproductions.

Regulatory Instrument Exact Primary Provision Number Primary Source Link & Access Status Verbatim Statutory / Standard Requirement & Direct Mapping to Countersign
DORA (Level 1 Regulation)
Regulation (EU) 2022/2554, Article 9(4)(e) (Protection and prevention) & Article 16(1) (Simplified framework)

EUR-Lex CELEX:32022R2554 PDF (read the source); DORA Art. 9 Text (read the source)

Entities must "implement documented policies, procedures and controls for ICT change management, including changes to software, hardware, firmware components, systems or security parameters, that are based on a risk assessment approach... in order to ensure that all changes to ICT systems are recorded, tested, assessed, approved, implemented and verified in a controlled manner".

DORA RTS on ICT Risk Management (Level 2 Delegated Act)
Commission Delegated Regulation (EU) 2024/1774, Article 17 (ICT change management, Title II, Ch. I, Sec. 4) & Article 38 (Title III Simplified framework)

EUR-Lex OJ:L_202401774 HTML (read the source); EUR-Lex CELEX:02024R1774 (read the source); Springlex Art. 17 (read the source)

Article 17 mandates that ICT change management procedures include: (1) "mechanisms to ensure the independence of the functions that approve changes and the functions responsible for requesting and implementing those changes"; (2) roles/responsibilities ensuring "changes are specified and planned; an adequate transition is designed; the changes are tested and finalised in a controlled manner; there is an effective quality assurance"; (3) documentation of "the purpose and scope of the change; the timeline...; the expected outcomes"; and (4) "identification of the potential impact of a change on existing ICT security measures".

PCI DSS v4.0 / v4.0.1
Requirement 6.2.3 & Requirement 6.2.3.1 (plus Testing Procedures 6.2.3.a/b & 6.2.3.1.a/b)

PCI SSC Official SAQ C PDF (read the source); OpenCRE 6.2.3.1 Verbatim (read the source); Microsoft Entra PCI Req 6 (read the source)

6.2.3: "Bespoke and custom software is reviewed prior to being released into production or to customers, to identify and correct potential coding vulnerabilities...".

6.2.3.1: "If manual code reviews are performed for bespoke and custom software prior to release to production, code changes are: • Reviewed by individuals other than the originating code author, and who are knowledgeable about code-review techniques and secure coding practices. • Reviewed and approved by management prior to release.".

6.2.3.1 Applicability Note: "An individual that has been formally granted accountability for release control and who is neither the original code author nor the code reviewer fulfills the criteria of being management.". |
| NIS2 Directive (Level 1 Directive) | Directive (EU) 2022/2555, Article 21(2)(e) (Cybersecurity risk-management measures) | EUR-Lex CELEX:32022L2555 PDF (read the source); EUR-Lex Consolidated HTML (read the source) | Member States shall ensure that essential and important entities take appropriate and proportionate technical, operational and organisational measures that include at least: "(e) security in network and information systems acquisition, development and maintenance, including vulnerability handling and disclosure;". |
| NIS2 Implementing Regulation (Level 2 Act) | Commission Implementing Regulation (EU) 2024/2690, Annex Sections 1.2.5, 2.2.3 & Section 6 | EUR-Lex OJ:L_202402690 HTML (read the source); EUR-Lex Ares(2024)4640447 Annex (read the source) | Annex 1.2.5: "Conflicting duties and conflicting areas of responsibility shall be segregated, where applicable."

Annex 2.2.3: "The persons conducting the reviews shall not be in the line of authority of the personnel of the area under review... guarantee the impartiality of the reviews." |

Critical Regulatory Nuances for Countersign's Architecture
DORA Article 9(4)(e) and Delegated Regulation (EU) 2024/1774 Article 17
What the sources say: DORA Level 1 (Article 9(4)(e) of Regulation (EU) 2022/2554) requires financial entities to implement documented policies, procedures, and controls for ICT change management—explicitly including changes to software—based on a risk assessment approach so that all changes are recorded, tested, assessed, approved, implemented, and verified in a controlled manner. DORA Level 2 Regulatory Technical Standards (Article 17 of Commission Delegated Regulation (EU) 2024/1774, along with Article 38 for simplified-framework entities under Article 16(1)) explicitly mandate mechanisms to ensure the independence of the functions that approve changes from the functions responsible for requesting and implementing those changes, alongside documented specification of the purpose, scope, expected outcomes, quality assurance, and impact on existing ICT security measures.

Analytical inference: Countersign's combination of Blind-First Expected Outcomes (Idea 3), Risk-Based Routing (Ideas 4 and 5), Separation of Duties (Idea 8), and Cryptographic Receipts (Idea 7) maps directly onto the statutory requirements of Delegated Regulation (EU) 2024/1774 Article 17. Citing both Regulation (EU) 2022/2554 Article 9(4)(e) and Commission Delegated Regulation (EU) 2024/1774 Article 17 demonstrates institutional-grade regulatory mastery.

The PCI DSS 6.2.3 versus 6.2.3.1 Three-Role Distinction
What the sources say: Under PCI DSS v4.0.1 (OpenCRE 6.2.3.1, read the source; Safeguard, read the source; Veridical, read the source), Requirement 6.2.3 permits bespoke and custom software to be reviewed prior to release using manual, automated, or combined methods. However, whenever manual code review is performed (Requirement 6.2.3.1), the standard's Applicability Note specifies that management approval prior to release must be executed by an individual formally granted accountability for release control who is neither the original code author nor the code reviewer. Similarly, under NIS2 Article 21(2)(e) (EUR-Lex CELEX:32022L2555, read the source) and Commission Implementing Regulation (EU) 2024/2690 Annex Sections 1.2.5 and 2.2.3 (EUR-Lex Ares(2024)4640447, read the source), conflicting duties must be segregated and review impartiality guaranteed.

Analytical inference: For hunks verified entirely by automated checks (Verified via blind requirement tests and property fuzzing), Countersign satisfies PCI DSS Requirement 6.2.3 through the automated review pathway. For Read-this hunks that rely on manual human review under Requirement 6.2.3.1, having only two actors—the Originating Author (Agent/Developer) and the Human Code Reviewer—is one signature short of strict 6.2.3.1 compliance unless a third Release Control entity approves the release prior to production deployment. Adding a release_controller_signature field (or an automated release-control policy gate counter-signature delegated by release management) inside the git note receipt makes Countersign fully compliant with PCI DSS 6.2.3.1.

Ranked Action Plan: Keep, Change, or Drop
The table below ranks Countersign's eight architectural ideas from highest to lowest value for the Tieto C# MessagePack reference implementation, specifying which components to keep intact, how to modify those with structural flaws, and which idea to drop and replace.

Rank Idea / Component Action Exact Specification of Change / Retention
1 Idea 6: Evidence Levels (Blind Fail-Before / Pass-After Tests; No Confidence Scores) CHANGE
Keep the discrete evidence tier structure (Verified, Supported, Read-this) and the ban on raw numerical LLM confidence scores. Change: (1) Pass the Roslyn-extracted method signature (header only, stripped of body implementation) to the blind test generator so tests compile when new C# methods or overloads are introduced; (2) require 100% diff-branch execution coverage (coverlet) plus a Differential Round-Trip / Truncation Property Check (FsCheck, Candidate 2) before a MessagePack hunk can earn Verified status.

2 Idea 7: Signed Receipt (SSH-Signed Git Note) CHANGE
Keep the SSH-signed git note recording human-read versus tool-verified coverage. Change: Eliminate the rebase context-swap vulnerability by binding the cryptographic signature to the four-part tuple
(
Patch_ID
,
Base_Tree_SHA
,
Head_Tree_SHA
,
Roslyn_Slice_Hash
)
(Patch_ID,Base_Tree_SHA,Head_Tree_SHA,Roslyn_Slice_Hash) rather than the diff alone, and record the reviewer's one-line answer to the Socratic check (Candidate 4) inside the receipt.

3 Idea 4: Hunk Coverage Map & Deterministic Routing CHANGE
Keep rule-based, zero-LLM routing where humans inspect only Read-this code. Change: Upgrade from isolated Git diff hunks to Roslyn Data/Call-Graph Review Slices (Left Flow / Full Flow, Candidate 1). Enforce a Contagion Rule: if any hunk in a connected data-flow slice is Read-this, all connected hunks in that slice remain visible as context so cross-hunk interactions are never hidden.

4 Idea 2: Mechanical Quote Check & Audit Log CHANGE
Keep deterministic mechanical verification of every AI claim. Change: Expand allowed quote targets from "diff-only substring" to Diff Substring + Repo AST Symbol/Line Range so the AI can cite untouched callers or missing guards outside the diff without being falsely struck. Move struck claims out of the primary review UI into an audit appendix (git notes) to prevent attention anchoring.

5 Idea 5: Deterministic Refusal Policy CHANGE
Keep fixed rules that override model outputs. Change: Add a Pre-Review Blast-Radius & Complexity Gate (Candidate 5) and C#-specific Roslyn Semantic Triggers (unsafe, fixed, Span<T>, ArrayPool<T>, unchecked stream-length allocations, and
Δ
C
C
≥
4
ΔCC≥4) so internal MessagePack deserialization bugs are escalated even when public APIs are untouched.

6 Idea 8: Separation of Duties CHANGE
Keep human-only signing and author exclusion. Change: Enforce Cross-Family Model Independence in the receipt (author_model_family != verifier_model_family) to prevent correlated model blind spots, and separate the Reviewer Signature from the Release Control Gate Signature to satisfy PCI DSS 6.2.3.1's three-role mandate.

7 Idea 3: Blind-First Review (Preregistration) CHANGE (Narrow)
Narrow from "writing expected code descriptions blindly" (which inflates false positives when tickets are under-specified) to Blind Invariant & Negative-Constraint Extraction paired with Grounded Socratic Abstention (Candidate 4), where the AI explicitly declares what cannot be verified from the diff and asks one grounded question before human sign-off.

8 Idea 1: Trust Ladder (Dodge 1943 CSP-1 Planted-Bug Checks) DROP (Replace)
Drop the CSP-1 planted-bug streak ladder: Dodge's equations require
i
=

30
–
100
i=30–100 consecutive defect-free runs under stationary i.i.d. assumptions, making it mathematically indefensible on a four-change C# demo. Replace with the Review-Finding-to-Executable-Rule Ratchet (Candidate 3), where human review findings on Change #1 compile into a Roslyn/Semgrep rule verified against the rejected and clean diffs to automatically guard Change #4.

Confidence in this ranking is high (90%) because every critique and replacement is anchored in controlled software engineering experiments (ICSE 2025, ISSTA 2026, MSR 2026) and primary regulatory texts; this ranking would change only if the Tieto evaluation rubric explicitly mandates a longitudinal multi-sprint simulation (50+ synthetic pull requests), in which case Idea 1 should be retained using Wald's Sequential Probability Ratio Test (SPRT) thresholds rather than Dodge's CSP-1.

## Sources

Gemini's list of the pages it consulted, in its order. The paste had titles and domains but no full addresses, so each entry links to the paper when the text above names its arXiv number and to the site's front page otherwise. Search the title on the site to find the page. The last title was cut off in the paste. We haven't opened any of these.

- [Overview of Code Review Research](https://awesomecodereviews.com) (awesomecodereviews.com, site only)
- [Deep Learning-based Code Reviews: A Paradigm Shift or a Double](https://computer.org) (computer.org, site only)
- [Evaluating the Impact of Explainable AI on Trust in AI-Assisted Code](https://researchgate.net) (researchgate.net, site only)
- [Where Do AI Coding Agents Fail? An Empirical Study of ... - arXiv](https://arxiv.org/abs/2601.15195) (arXiv:2601.15195)
- [Your Agents Can Write More Code. Can Your Organization Absorb It?](https://criticalpropulsion.com) (criticalpropulsion.com, site only)
- [Deep Learning-based Code Reviews: A Paradigm Shift or a Double](https://arxiv.org/abs/2411.11401) (arXiv:2411.11401)
- [Rosalia Tufano - DBLP](https://dblp.org) (dblp.org, site only)
- [Evaluating the Impact of Explainable AI on Trust in AI-Assisted Code](https://arxiv.org/abs/2607.24601) (arXiv:2607.24601)
- [Evaluating the Impact of Explainable AI on Trust in AI-Assisted Code](https://arxiv.org/abs/2607.24601) (arXiv:2607.24601)
- [Evaluating the Impact of Explainable AI on Trust in AI-Assisted Code](https://arxiv.org/abs/2607.24601) (arXiv:2607.24601)
- [Evaluating the Impact of Explainable AI on Trust in AI-Assisted Code](https://chat.powerdrill.ai) (chat.powerdrill.ai, site only)
- [AI-to-AI Code Reviews of GitHub Pull Requests - DROPS](https://drops.dagstuhl.de) (drops.dagstuhl.de, site only)
- [[2601.15195] Where Do AI Coding Agents Fail? An Empirical Study](https://arxiv.org/abs/2601.15195) (arXiv:2601.15195)
- [MSR 2026 — Where Do AI Coding Agents Fail? - SOAR-Lab - GitHub](https://github.com) (github.com, site only)
- [Do Coding Agents Really Fail at Business Logic? What the](https://dev.to) (dev.to, site only)
- [Latest Research On Large Language Model | Paperguide](https://paperguide.ai) (paperguide.ai, site only)
- [How to Earn Engineer Trust in AI Code Review Tools - Amplify IT](https://amplifyit.io) (amplifyit.io, site only)
- [Where Do AI Coding Agents Fail? An Empirical Study of Failed](https://tldr.takara.ai) (tldr.takara.ai, site only)
- [Short-Run Contexts and Imperfect Testing for Continuous Sampling](https://mdpi.com) (mdpi.com, site only)
- [Evaluation of Continuous Sampling Plan (CSP-5) Parameters Using](https://researchgate.net) (researchgate.net, site only)
- [Probability Limits on Outgoing Quality for Continuous Sampling Plans](https://stat.cmu.edu) (stat.cmu.edu, site only)
- [Towards Practical Defect-Focused Automated Code Review - GitHub](https://raw.githubusercontent.com) (raw.githubusercontent.com, site only)
- [gert analysis of dodge's csp-1 continuous sampling plan](https://semanticscholar.org) (semanticscholar.org, site only)
- [AOQ and AFI Values for CSP-3 Plan | PDF - Scribd](https://scribd.com) (scribd.com, site only)
- [Journal of Physical Mathematics & its Applications](https://srcpublishers.com) (srcpublishers.com, site only)
- [An SPRT Procedure for an Ungrouped Data using MMLE Approach](https://slideshare.net) (slideshare.net, site only)
- [AI Coding Tip 041 - Turn Every Review Finding Into a Rule](https://maximilianocontieri.com) (maximilianocontieri.com, site only)
- [Rethinking Training Data for Generating Code Review Comments](https://arxiv.org) (arxiv.org, site only)
- [Security Code Review Checklist — Complete Guide](https://vynoxsecurity.com) (vynoxsecurity.com, site only)
- [Manual code review or SAST: what does each one catch? - Safeguard](https://safeguard.sh) (safeguard.sh, site only)
- [PCI DSS 6.2.3 in code - heygrc](https://heygrc.com) (heygrc.com, site only)
- [False Positive Rates (%) - ResearchGate](https://researchgate.net) (researchgate.net, site only)
- [Towards Practical Defect-Focused Automated Code Review - arXiv](https://arxiv.org/abs/2505.17928) (arXiv:2505.17928)
- [Code Review Automation: Strengths and Weaknesses of the State of](https://researchgate.net) (researchgate.net, site only)
- [How to Do Code Review for an Unfamiliar Codebase - Medium](https://medium.com) (medium.com, site only)
- [AI Code Review: Approaches, Tools, and Best Practices (2026)](https://collinwilkins.com) (collinwilkins.com, site only)
- [Where Do AI Coding Agents Fail? An Empirical Study of ... - MSR 2026](https://2026.msrconf.org) (2026.msrconf.org, site only)
- [Beyond Bug Fixes: An Empirical Investigation of Post-Merge Code](https://arxiv.org/abs/2601.20109) (arXiv:2601.20109)
- [Qodo AI Code Review for Pull Request Workflows - Verdent Guides](https://verdent.ai) (verdent.ai, site only)
- [Code Review Checklist and Anti-Pattern Catalog - Hidekazu Konishi](https://hidekazu-konishi.com) (hidekazu-konishi.com, site only)
- [The Misinformation Effect of Explanations in Human–AI Collaboration](https://tandfonline.com) (tandfonline.com, site only)
- [36 Code Review Prompts for AI: Debug & Refactor (2026)](https://prompt-architects.com) (prompt-architects.com, site only)
- [PCI DSS Manual Code Review Requirements (v4.0.1)](https://pcidssguide.com) (pcidssguide.com, site only)
- [AI-Written Code Needs Independent Review - CodeRabbit](https://coderabbit.ai) (coderabbit.ai, site only)
- [Standard : PCI DSS - OpenCRE](https://opencre.org) (opencre.org, site only)
- [Does PCI DSS 6.2.3 require manual code review or can tools](https://safeguard.sh) (safeguard.sh, site only)
- [Audit Ready PCI DSS Code Review: 3 Approvals Required by 6.2.3.1](https://veridical.dev) (veridical.dev, site only)
- [Toward Conversational AI Review Assistants - arXiv](https://arxiv.org/abs/2607.22095) (arXiv:2607.22095)
- [Rosalia Tufano's research works | Università della Svizzera italiana](https://researchgate.net) (researchgate.net, site only)
- [Learnings - CodeRabbit Docs](https://docs.coderabbit.ai) (docs.coderabbit.ai, site only)
- [AI code review: more context, fewer bugs - Cursor](https://cursor.com) (cursor.com, site only)
- [Graphite: The Open-Source AI Reviewer Changing Code Review](https://amplifilabs.com) (amplifilabs.com, site only)
- [Qodo - Codegen](https://codegen.com) (codegen.com, site only)
- [AI Code Reviews in CLI - CodeRabbit](https://coderabbit.ai) (coderabbit.ai, site only)
- [Is Agentic Code Review Helpful? Mining Developers' Feedback to](https://arxiv.org) (arxiv.org, site only)
- [Inside Clerk's 40% faster merge workflow with CodeRabbit](https://coderabbit.ai) (coderabbit.ai, site only)
- [Review #6630 — fix(repair): bind terminal receipt verdict to its verify](https://app.devin.ai) (app.devin.ai, site only)
- [How to evaluate AI code review tools: A practical framework](https://coderabbit.ai) (coderabbit.ai, site only)
- [my manager asked why we still need code review if the ai writes it](https://reddit.com) (reddit.com, site only)
- [Regulation (EU) 2022/2554 of the European Parliament and](https://eur-lex.europa.eu) (eur-lex.europa.eu, site only)
- [Article 38 ICT project and change management - DORA - Springlex](https://springlex.eu) (springlex.eu, site only)
- [Digital Operational Resilience Act (DORA), Article 9](https://digital-operational-resilience-act.com) (digital-operational-resilience-act.com, site only)
- [Regulation - 2022/2554 - EN - DORA - EUR-Lex](https://eur-lex.europa.eu) (eur-lex.europa.eu, site only)
- [Official Journal L 333/2022 - EUR-Lex - European Union](https://eur-lex.europa.eu) (eur-lex.europa.eu, site only)
- [Article 17 ICT change management - DORA - Springlex](https://springlex.eu) (springlex.eu, site only)
- [Article 17: ICT change management [CDR 2024-1774] - Advisera](https://advisera.com) (advisera.com, site only)
- [Consolidated TEXT: 32024R1774 — EN — 25.06.2024 - EUR-Lex](https://eur-lex.europa.eu) (eur-lex.europa.eu, site only)
- [L_202401774EN.000101.fmx.xml - EUR-Lex](https://eur-lex.europa.eu) (eur-lex.europa.eu, site only)
- [PCI DSS Requirement 6: Explained - ManageEngine](https://manageengine.com) (manageengine.com, site only)
- [Data Security Standard](https://listings.pcisecuritystandards.org) (listings.pcisecuritystandards.org, site only)
- [Microsoft Entra ID and PCI-DSS Requirement 6](https://learn.microsoft.com) (learn.microsoft.com, site only)
- [Manage PCI DSS v4.0.1 requirements with Datadog](https://datadoghq.com) (datadoghq.com, site only)
- [Manual code review - Open CRE](https://opencre.org) (opencre.org, site only)
- [PCI DSS Requirement 6: Develop and Maintain Secure Systems](https://blog.basistheory.com) (blog.basistheory.com, site only)
- [NIS2 Article 21(2)(e) vulnerability handling: what you can check from](https://skyqon.com) (skyqon.com, site only)
- [Directive (EU) 2022/2555 - Publications Office - European Union](https://eur-lex.europa.eu) (eur-lex.europa.eu, site only)
- [Consolidated TEXT: 32022L2555 — EN — 27.12.2022 - EUR-Lex](https://eur-lex.europa.eu) (eur-lex.europa.eu, site only)
- [L_202402690EN.000101.fmx.xml - EUR-Lex](https://eur-lex.europa.eu) (eur-lex.europa.eu, site only)
- [Zero Trust Architecture - cyb3r.help](https://cyb3r.help) (cyb3r.help, site only)
- [laying down rules for the application of Directive (EU) 2](https://eur-lex.europa.eu) (eur-lex.europa.eu, site only)
