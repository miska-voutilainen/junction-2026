# UI build plan

How the design canvas ([Countersign design](https://claude.ai/artifact/PAtNks6iioQVqMH9fxkkE5), Desktop and Mobile pages) becomes the app. The canvas sets layout, look and motion; [the spec](../spec.md) sets data and copy. The canvas was drawn with sample data from an imagined product connected to GitHub and CI (REQ-142, builder-7, Elina, "countersign/platform", "last 30 days"). We build the same screens over what we have: four recorded reviews of Tieto's MessagePack-CSharp changes, the report card and the signed receipt.

## 1. Rules for translating the canvas

1. **Real or cut.** Each element shows data from `data/` (or its fixture), runs in the browser and says so, or is cut. No dead buttons, no invented people or numbers.
2. **Our areas, our ids.** The areas are generator, analyzer, security and performance (not Frontend or Backend). The ids are `mp-2283` and `MP-2283`. Deciders come from `src/policy/refusals.ts`.
3. **Honest states.** The site is static, so there is no "fetching from GitHub". Loading is the route skeleton during client navigation. Errors are a data file that is missing or fails validation. We keep the canvas's state layouts, rewrite their copy to what can really happen, and show the real error text in a console.
4. **Spec copy wins** where the spec gives exact copy (tier banner reasons with rule ids, empty-state commands). The canvas wins on layout and on copy the spec doesn't give.
5. **Copy style.** Page titles (the h1, the breadcrumb name, the `<title>`) are in Title Case: "Reviewer Report Card". Everything else (section headings, buttons, tabs, labels, nav items) is sentence case. Copy we write has no semicolons and no "→" (split the sentence, or say "then"); code, CLI output and text written by the AI or people keep their own punctuation. `e2e/a11y.spec.ts` guards the punctuation.

## 2. Tokens: `src/styles/tokens.css`

One file, CSS custom properties on `:root`, dark only. `globals.css` maps them into Tailwind's `@theme`, and maps shadcn's variables (`--background`, `--card`, `--popover`, `--primary`, `--muted`, `--accent`, `--border`, `--input`, `--ring`, `--destructive`) onto them, so shadcn primitives render in our palette. The light theme block goes.

| Group | Tokens |
| --- | --- |
| Surfaces | `bg #0D0F12`, `raised #0F1216` (top bar, nav), `panel #111418` (tables, cards), `code #0B0D10`, `hover #13171E`, `control #22272E` / `control-hover #2A3038` (inputs), `selected #1A1F27` (active nav item, active command row), `scrim` (overlay, rgba of bg) |
| Borders | `subtle #1F242B`, `default #262C34`, `strong #2A3038` |
| Text | `primary #E6E8EB`, `secondary #C4CAD3`, `muted #9AA3AF`, `faint #939CA8` (floor). The canvas's in-between greys (`#8A939F`, `#8C95A2`, `#AEB6C1`, `#B7BFCA`) map to the nearest token at or above the floor. |
| Brand | `brand #3558E8`, `brand-hover #4566F2`, `focus-ring #4566F2`, `focus-ring-on-brand #93AAFF`, `link #93AAFF`, logo colours (logo only) |
| Semantic | `amber`/`amber-light` (Read this, Unverified, Stale), `rose`/`rose-light` (contradiction, escape, error), `green`/`green-light` (only "Signature verified" and "Unlocked") |
| Type | Inter (sans) and JetBrains Mono (mono). Scale: `xs 12` (floor; the canvas's 10.5 px kbd chips go up to 12), `sm 13`, `base 14`, `md 15`, `lg 18`, `xl 22`, `2xl 24`, `display 40` (gate digits). `tabular-nums` everywhere, `text-wrap: balance` on headings. |
| Radius | `page 12`, `menu 14` (command menu), `control 10`, `button 9`, `item 7` (nav and menu rows), `chip 4`. Nested radius = outer minus padding. |
| Layout | `topbar 56`, `nav 248`, `navigator 264`, `steps-panel 392`, `content-max 1280`, `prose-max 820` (receipt) |
| Motion | `ease-out cubic-bezier(.2,.8,.2,1)`, `ease-in-out cubic-bezier(.4,0,.2,1)`, `dur-fast 150`, `dur-base 200`, `dur-slow 250`, `stagger 30` (cap 10 rows), exits at 0.8× |

Spacing stays on Tailwind's 4 px scale. The gate's one-off sizes (`text-[40px]`, `max-w-[380px]`) move onto these tokens.

## 3. App shell

`src/components/AppShell.tsx`: top bar, nav and content. Every page except `/unlock` uses it.

**TopBar** (56 px, `raised`)
- Wordmark, linking to `/`.
- Repository label: the static mono text of `ChangeInput.repo` ("miska-voutilainen/junction26-messagepack-csharp", Tieto's fork), ellipsis when narrow. It's a label, not a switcher: there is one repository.
- Breadcrumb (Inbox / `mp-2283` / Receipt).
- Search button "Search or jump to… ⌘K", which opens the CommandMenu. Below ~900 px it becomes an icon button.
- "Simulated escapes: n" and "Reset" from the spec, shown only when escapes exist.
- Cut: notifications, account avatar.

**AppNav** (248 px, ≥ 900 px; below that a menu button in the top bar opens it as a sheet)
- Review: Inbox, with a badge for the number of changes needing review.
- Insights: Dashboard, Reviewer.
- Footer: "Keyboard shortcuts" disclosure, listing only the shortcuts we build.
- The selected item's background moves between items with a shared `layoutId`.
- Cut: "Calibration · Synthetic changes" (planted bugs never appear as changes; the report card lists them), Settings.

**CommandMenu** (⌘K / Ctrl+K)
- A Radix Dialog with a cmdk list. It opens from the search button's position (scale .95 to 1, opacity) and closes back to it. Esc returns focus to the trigger; arrow keys move; Enter opens.
- Quick actions: Review next change (the first in inbox order), Copy sign command (for the change in view, else the next), Record an escape (to `/reviewer`).
- Go to: Inbox, Dashboard, Reviewer Report Card.
- Changes: the four Tieto changes with tier and receipt status.
- Empty: "No match for "…". Try a change id, a requirement or a page."
- Rows fade up with the stagger. "Copied" is announced politely.

**Mobile header** (< 760 px, from the Mobile page): back link or wordmark, page title, search icon, and one cross-link (Inbox ↔ Dashboard).

**Shortcuts:** ⌘K; `N` review next; `j`/`k` move in the inbox; Enter opens; `g i`, `g d`, `g r` go to Inbox, Dashboard, Report card; `1`–`4` switch Review steps. None fire while typing in a field.

## 4. Components

**Primitives** (`src/components/ui/`, shadcn, generated): button, badge, tooltip, tabs, skeleton, sonner, separator, scroll-area, kbd. To add: dialog, sheet, collapsible, command (needs `cmdk`).

**Shared** (`src/components/`):

| Component | What it is |
| --- | --- |
| `AppShell`, `TopBar`, `AppNav`, `MobileHeader`, `CommandMenu`, `Wordmark` | Shell, above |
| `IdeaLabel` | "Idea N · Name ↗". Small, muted, focusable, new tab. All eight ideas are defined once in `src/lib/ideaLinks.ts` with their short name and their page in `docs/ideas/` (spec section 1 table, section 3 "Idea labels"); idea 8 is "Separation of duties" |
| `EvidenceMark` + `EvidenceBadge` | Verified: filled dot. Supported: ring. Unverified: amber dashed ring. Refused: ring with slash. Always with the text label |
| `CoverageMark` | Gutter bar and label: Read this (amber solid), Supported (grey dashed), Verified (grey solid) |
| `TierBadge` | Signal bars (1–3) and "Light", "Focused" or "Full" |
| `ReceiptStatus` | "Needs review", "Signed by <owner>", "Stale" or "Signature failed verification" (spec T06). The Inbox shows all four; the Review header shows only Stale and the failed state, because the roles line owns "Signed by" |
| `RolesLine` | Idea 8: "Written by <author agent> · Reviewed by <reviewer version> · Signed by <owner>", a muted "Not signed yet", "Receipt couldn't be read" or "Signature failed verification" instead of a name unless a verified receipt exists (a stale receipt still names its signer); with no readable review the reviewer part is left out. The version is mono, names are sans. Below 760 px the three roles stack one per line without separators; from 760 px they share a line with "·" separators, each pair kept whole. Used on its own row in the Review header and in the Receipt identity fields |
| `LevelLadder` | Shadow, Calibrated and Trusted, three steps, current one marked |
| `Console` | Code or output box with a Wrap/Copy toolbar (section 6) |
| `CopyButton` | Copy-to-check icon crossfade for 1.5 s, fixed width, "Copied" announced politely |
| `Disclosure` | Accordion with `aria-expanded`/`aria-controls` and a clip reveal (no height jank) |
| `SegmentedControl` | Filter pills with a shared-layout selected segment |
| `EmptyState`, `ErrorState`, `PageSkeleton` | The States boards' layouts. `ErrorState` takes the real error into a `Console` |
| `MockDataBanner` | Spec: "Showing mock data" whenever a fixture fed the page |

**Lib:** `src/lib/motion.ts` (presets: fade-up item, popover, crossfade, press), `src/lib/useWrapPreference.ts` (localStorage, try/catch), `src/lib/useShortcut.ts`, `src/lib/ideaLinks.ts`. Data comes from T06's loaders in `src/lib/data/` and simulated escapes from `src/lib/simulation/`.

## 5. Screens, in build order

Each screen ships with its loading (`loading.tsx` skeleton as drawn), empty and error states, keyboard support, and layouts at 320–1920 px. Each is deployed on its own.

**Prerequisites (Phase 3, in parallel with the shell):**
- T06: loaders, fixtures, `receiptStatus()`, the escape store.
- T11: `route()` and the ladder (engine lane, also mine).

The Inbox computes tiers in the browser with `route()`. Fixtures stand in until the evidence lane's sample data and the recorded runs land, and the mock-data banner says so.

1. **Inbox `/`** (Phase 3). Canvas Main, InboxMobile, InboxStates.
   - h1 "Inbox"; "Agent changes waiting for a named person to sign."
   - Primary "Review next" with the change id and an `N` chip.
   - Summary bar: signed-share pips, "4 changes · 0 Light · 3 Focused · 1 Full · 1 signed", and the spec's "Humans read r of n hunks · ~m of f min".
   - Status filter: All · Needs review · Stale · Signed, with counts.
   - Table columns: status, change, effort (tier, read r of n, coverage cells), risk (contradictions, refused), receipt, open. "Age" is cut: we have no PR open times.
   - Signed changes sit in a "Signed" fold.
   - Mobile: Sign here (Light or stale), Needs a desktop (Focused/Full, "Open read-only"), Signed fold.
   - Cut: "Decide" approve/reject and "Send to my desktop" (no backend). Mobile shows open refusals as "Waiting on a decision" links to step 3.
   - States: empty "No recorded reviews yet." plus the `pnpm pipeline run mp-2283` command; per-row "Not reviewed yet" and "couldn't be read"; error "Couldn't read the recorded reviews" with the validation error in a console.
2. **Review `/changes/[id]`** (Phase 4). Canvas Review, ReviewMobile, ReviewStates, Sidebar, SidebarTabs.
   - Header: title, id, receipt status only when it asks for action (Stale, Signature failed verification) with "View full receipt", "Sign" primary (`4`). The author agent chip is gone: the roles line states it.
   - Coverage line: "Focused: read 2 of 8 hunks · ~2 min (full read ~10 min)", then the spec's reasons, one line each with rule id, under a disclosure. Idea 3. A simulated escape adds "R-escape" (Full) for each touched area, e.g. "Analyzer: a bug escaped here, the next changes get a full read".
   - Meta row: branch, +/− and files, then "<model> · <date>". The roles line (Idea 8) is its own row below ("Written by … · Reviewed by rv1 · Signed by <owner>", "Not signed yet", or "Receipt couldn't be read" for an unreadable receipt file).
   - Navigator: Read this (with "0/2 read" progress), Supported, Verified. Below ~1100 px it becomes a dropdown.
   - Diff: Read-this hunks open with Wrap/Copy/Mark read; then "Covered by evidence: n hunks", with each hunk's evidence line built from its claims. A hunk whose only test evidence is the PR's own test (`pr-test`, no `differential-test`) reads "Supported · the PR's own test", followed by "quote checked at <file>:<line>" when the claim also cites one, with Idea 8 on its own line under it and the row's tooltip "The same agent wrote the code and this test, so it can't make the claim Verified." On a phone the covered hunks are one summary line, so this line is desktop only. "Mark read" is browser-only and says so.
   - Review steps: tabs 1 Read · 2 Blind check · 3 Refused · 4 Sign, with a shared-layout underline.
     - 1 Read is the spec's Story: what, why, touches, claims by requirement item, defects. A claim backed only by the PR's own test shows "Supported · the PR's own test", Idea 8 and the same note when opened.
     - 2 Blind check: contradiction "The PR says / The code does" with "Show in diff", anchored-vs-blind counts, Missing, Scope creep.
     - 3 Refused: rule, reason, "Decides: <decider>" from policy, links to hunks. Each refusal has a small neutral chip (a tap toggles its tooltip on a phone): "Fixed rule" (a code rule raised it, tooltip "A fixed policy rule raised this, no model involved. It always reaches a person, whatever the model says.") or "AI".
     - 4 Sign: draft read-only, `countersign draft`/`sign` consoles; signed with verify console and one seal pulse; stale with both hashes.
   - Cut: "Request changes", "Ask builder-7 to fix", "Ask Jonas", "Check signature", editable receipt textareas (the draft is edited in the file `countersign draft` writes).
   - Mobile: header, coverage line, Read-only hunks, Review steps, sticky Sign bar.
   - States:
     - Loading: the skeleton as drawn, "Tier pending".
     - Empty: "This change has no diff".
     - Error, evidence unavailable: when the report card is missing or invalid, every area counts as Shadow, `route()` gives Full, and the alert says so ("read 8 of 8 hunks"). The diff stays.
     - Not found and review-invalid copy per the spec.
3. **Receipt `/changes/[id]/receipt`** (Phase 4). Canvas Receipt.
   - Toolbar: Copy verify command, Copy link, Print (`window.print`; print stylesheet). "Signature verified" seal.
   - Fields: commit, base, diff hash, repo, reviewer run, and the roles line (Idea 8), which replaces the separate author and signer rows.
   - The three sections in sans (people's words); the hunk ledger, headed "Hunk ledger · signed" with the note "Part of the signed payload: the signature covers which hunks <owner> read and which checks covered the rest." (hunk id, file, coverage, "Read by <owner>"; for a receipt whose signature failed verification the heading is plain "Hunk ledger" and the note says "The signature over this ledger failed verification."), read from `receipt.hunks` in the signed payload, so a stale receipt shows it too; open decisions; verify output console.
   - Per-hunk hashes are cut: the receipt signs one `diffSha256`, and we show that.
   - Not signed: "No receipt for mp-2283 yet." and the sign command. Stale: banner.
4. **Reviewer `/reviewer`** (Phase 4). Canvas Reviewer, ReviewerMobile, ReviewerStates.
   - h1 "Reviewer Report Card"; "Measured on n planted bugs and p planted contradictions, planted by an agent that never saw the prompts".
   - "How levels work" disclosure.
   - Four area cards: level, ladder, "3 of 4 planted bugs caught · planted blind to the prompts", blind-first vs described-first counts, "Effect now", next step, "Record escape" with Undo (simulated, toast, re-routes).
   - Lists: Missed planted bugs, Hallucinations caught, Retracted claims, all from the report card and reviews. Hallucinations caught has two scoped sub-lists: quotes that failed the check, and refusals struck for an unknown rule id ("Refusal r3 · unknown rule id" with the change id, or "None in the 4 recorded reviews.").
   - Spec's routing spread line.
   - "Plant a synthetic bug" (the one primary) opens a dialog with the real steps (variant branch, answer key, `pnpm evals`) in a console.
   - States: loading as drawn, empty "Every area is at Shadow", error with "every area is treated as Shadow" and the validation error.
5. **Dashboard `/dashboard`** (Phase 4). Canvas Dashboard, DashboardMobile, DashboardStates.
   - Facts:
     - Signed (receipts)
     - Hunks read by a person (r of n)
     - Contradictions caught
     - Escapes recorded (simulated)
     - Median time to sign: "not measured yet"
   - Accepted risk: residual-risk lines from signed receipts, with status Holds or Stale from `receiptStatus()`.
   - Open decisions: refusals grouped by decider.
   - Attention by tier: read vs covered hunks per tier.
   - Why changes were escalated: `route()` reason counts.
   - Reviewer trust by area.
   - Cut: the 7/30/90-day range (we have four changes, not a time series).
   - States as drawn, copy rewritten.

## 6. Code consoles (Wrap and Copy)

Only these scroll sideways, inside their own box. Copy takes the raw text. The Wrap choice is remembered per console kind.

| Console | Screen | Default |
| --- | --- | --- |
| Diff hunk (Read-this cards and expanded covered hunks) | Review | No wrap |
| Read-only hunks | Review, mobile | No wrap |
| Verified claim test output (base fails / head passes) | Review step 1 | No wrap |
| Sign commands (`countersign draft`, `sign`) | Review step 4 | No wrap |
| `countersign verify` output | Review step 4, Receipt | No wrap |
| Stale: both diff hashes | Review step 4, Receipt | No wrap |
| Hunk ledger, when its lines exceed the width | Receipt | No wrap |
| Plant-a-bug steps | Reviewer dialog | No wrap |
| Error details (validation error, file path) | Every error state | Wrap (prose-like) |
| `pnpm pipeline run` / `pnpm evals` in empty states | Inbox, Reviewer | No wrap |

Claim quotes and the contradiction snippet stay plain mono blocks that wrap, without a toolbar: they're one or two lines, and the Copy affordance belongs to the hunk they cite.

## 7. Decisions needed before Phase 3

My recommendation is first in each.

1. **Spec update.** `/dashboard`, `/changes/[id]/receipt`, the AppNav, the CommandMenu, the step names (1 Read · 2 Blind check · 3 Refused · 4 Sign) and the Inbox filters aren't in the spec, and the spec wins until changed. Recommend: one spec PR now that adopts this plan's section 5, keeping the spec's data rules and copy. Alternative: build S1–S3 only.
2. **Report card lane.** `src/features/report-card/` is Veijo's (evidence). Recommend: it moves to the app lane, with his agreement on #1, and Veijo keeps the data and CLIs. Alternative: Veijo builds S3 from this plan.
3. **Dependencies.** `motion` (MIT; shared `layoutId` indicators, presence and crossfades) and `cmdk` (MIT; the command list, shadcn's Command). Recommend: both, in one `chore(deps)` PR. Alternative: CSS-only motion, which loses the shared-layout indicators the brief asks for.
4. **Canvas controls with no backend** (section 5's "Cut" lines). Recommend: cut them. Alternative: keep a few as browser-only with a "simulated" label, like escapes.
5. **Dashboard with four changes.** Recommend: build it with the real, small numbers and their sample size. Alternative: cut it and fold "Attention by tier" into the Inbox summary.

## 8. Phases

| Phase | Builds | PRs |
| --- | --- | --- |
| 3 | `chore(deps)`; tokens and shadcn mapping; shell (TopBar, AppNav, CommandMenu, MobileHeader); shared components; T06 data and T11 `route()` in parallel; Inbox with all states | ~5, each under 400 lines |
| 4 | Review (header and navigator; diff and consoles; Review steps), Receipt, Reviewer, Dashboard | ~6, deployed after each screen |
| 5 | axe, keyboard pass, 320–1920 px sweep, reduced motion, copy and spacing against the canvas | fixes |
