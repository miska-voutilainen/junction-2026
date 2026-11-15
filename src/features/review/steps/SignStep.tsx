"use client";

import Link from "next/link";
import { ShieldX, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Console } from "@/components/Console";
import { CopyButton } from "@/components/CopyButton";
import { IdeaLabel } from "@/components/IdeaLabel";
import { ReceiptSeal } from "@/components/ReceiptSeal";
import type { Review } from "@/contracts";
import { STALE_BODY, STALE_TITLE, verifyLine } from "@/lib/receiptCopy";
import { ReceiptSections } from "./ReceiptSections";
import type { SignCommands, SignView } from "./signModel";
import { countersignCommand } from "@/lib/countersignCommand";
import { formatSignedAt } from "@/lib/formatSignedAt";

interface SignStepProps {
  view: SignView;
  review: Review;
}

/**
 * Step 4, the signed receipt (idea 7). The site never signs: signing needs
 * the owner's own SSH key, so an unsigned change shows the AI's draft and the
 * command to run in a terminal. A signed receipt shows its verified seal, a
 * stale one the two diff hashes that no longer match, and one whose signature
 * failed the recorded check says so with the output. Spec section 3, S2 Receipt.
 */
export function SignStep({ view, review }: Readonly<SignStepProps>) {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-text-primary">
          Receipt for {review.requirement.id}
        </h3>
        <IdeaLabel n={7} />
      </header>
      {view.status === "unreadable" && <Unreadable changeId={review.changeId} />}
      {view.status === "needs-review" && <Unsigned view={view} review={review} />}
      {view.status === "signed" && <Signed view={view} review={review} />}
      {view.status === "stale" && <Stale view={view} changeId={review.changeId} />}
      {view.status === "unverified" && <Unverified view={view} changeId={review.changeId} />}
    </div>
  );
}

function Unsigned({
  view,
  review,
}: Readonly<{ view: Extract<SignView, { status: "needs-review" }>; review: Review }>) {
  return (
    <>
      <p className="text-sm text-text-secondary">
        Drafted by the AI. Only a named human can sign it.
      </p>
      <ReceiptSections body={view.draft} review={review} />
      <SignCommandsBlock commands={view.commands} heading="Sign on your own machine" />
    </>
  );
}

/** The draft and sign commands, and the primary Sign button that copies the sign command. */
function SignCommandsBlock({
  commands,
  heading,
}: Readonly<{ commands: SignCommands; heading: string }>) {
  const hintId = "sign-hint";
  return (
    <section
      aria-label={heading}
      className="flex flex-col gap-3 border-t border-border-subtle pt-4"
    >
      <h4 className="text-xs font-medium text-text-muted">{heading}</h4>
      <p id={hintId} className="text-sm text-text-secondary">
        Signing happens in your terminal with your own SSH key.
      </p>
      <Console
        label="Draft command"
        text={commands.draft}
        kind="log"
        heading={<CommandHeading note="writes the draft to edit" />}
      />
      <Console
        label="Sign command"
        text={commands.sign}
        kind="log"
        heading={<CommandHeading note="signs with your key" />}
      />
      <div>
        <CopyButton
          text={commands.sign}
          label="Sign"
          variant="text"
          describedBy={hintId}
          className="h-9 bg-brand px-4 font-semibold text-primary-foreground hover:bg-brand-hover focus-visible:outline-focus-ring-on-brand"
        />
      </div>
    </section>
  );
}

function CommandHeading({ note }: Readonly<{ note: string }>) {
  return <span className="truncate text-xs text-text-muted">{note}</span>;
}

/** The receipt file is there but fails validation: nothing to sign against, so no Sign button, only the way to re-export it. */
function Unreadable({ changeId }: Readonly<{ changeId: string }>) {
  return (
    <>
      <Notice
        tone="rose"
        icon={<ShieldX aria-hidden="true" className="size-4 shrink-0" />}
        title="The receipt file couldn't be read."
      >
        Re-export it with the command below, or open the receipt page for the details.
      </Notice>
      <Console
        label="Export command"
        text={countersignCommand("export", changeId)}
        kind="log"
        heading={<CommandHeading note="writes the receipt file again" />}
      />
      <ReceiptLink changeId={changeId} label="Open the receipt page" />
    </>
  );
}

function Signed({
  view,
  review,
}: Readonly<{ view: Extract<SignView, { status: "signed" }>; review: Review }>) {
  return (
    <>
      <div className="flex items-center gap-4">
        <ReceiptSeal size={40} />
        <span className="text-sm text-text-secondary">
          Signed by {view.receipt.owner} · {formatSignedAt(view.receipt.signedAt)}
        </span>
      </div>
      <ReceiptSections body={view.receipt} review={review} signedRunId={view.receipt.reviewRunId} />
      <section
        aria-label="Verify"
        className="flex flex-col gap-2 border-t border-border-subtle pt-4"
      >
        <h4 className="text-xs font-medium text-text-muted">Verify</h4>
        <VerifyConsole verify={view.verify} />
        <p className="text-sm text-text-secondary">{verifyLine("signed")}</p>
        <ReceiptLink changeId={review.changeId} label="View full receipt" />
      </section>
    </>
  );
}

function VerifyConsole({
  verify,
}: Readonly<{ verify: Extract<SignView, { status: "signed" }>["verify"] }>) {
  return (
    <Console
      label="Verify output"
      text={verify.output}
      kind="output"
      heading={
        <span className="truncate font-mono text-xs text-text-muted">$ {verify.command}</span>
      }
    />
  );
}

function Stale({
  view,
  changeId,
}: Readonly<{ view: Extract<SignView, { status: "stale" }>; changeId: string }>) {
  const hashes = `signed   ${view.receipt.diffSha256}\ncurrent  ${view.reviewDiffSha256}`;
  return (
    <>
      <Notice
        tone="amber"
        icon={<TriangleAlert aria-hidden="true" className="size-4 shrink-0" />}
        title={STALE_TITLE}
      >
        {view.receipt.owner} signed {formatSignedAt(view.receipt.signedAt)}. {STALE_BODY}
      </Notice>
      <Console
        label="Diff hashes"
        text={hashes}
        kind="log"
        heading={<span className="truncate text-xs text-text-muted">diffSha256</span>}
      />
      <SignCommandsBlock commands={view.commands} heading="Re-sign on your own machine" />
      <ReceiptLink changeId={changeId} label="View the signed receipt" />
    </>
  );
}

function Unverified({
  view,
  changeId,
}: Readonly<{ view: Extract<SignView, { status: "unverified" }>; changeId: string }>) {
  return (
    <>
      <Notice
        tone="rose"
        icon={<ShieldX aria-hidden="true" className="size-4 shrink-0" />}
        title={verifyLine("unverified")}
      >
        The recorded check of {view.receipt.owner}&apos;s signature did not pass, so this receipt
        vouches for nothing.
      </Notice>
      <VerifyConsole verify={view.verify} />
      <Console
        label="Verify command"
        text={view.commands.verify}
        kind="log"
        heading={<CommandHeading note="run it to check again" />}
      />
      <ReceiptLink changeId={changeId} label="View full receipt" />
    </>
  );
}

function ReceiptLink({ changeId, label }: Readonly<{ changeId: string; label: string }>) {
  return (
    <Link
      href={`/changes/${changeId}/receipt`}
      className="w-fit rounded-chip text-sm text-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring"
    >
      {label}
    </Link>
  );
}

/** An amber or rose notice. The icon and the title carry the meaning, so colour is never alone. */
function Notice({
  tone,
  icon,
  title,
  children,
}: Readonly<{ tone: "amber" | "rose"; icon: ReactNode; title: string; children: ReactNode }>) {
  const colour =
    tone === "amber" ? "border-amber/40 text-amber-light" : "border-rose/40 text-rose-light";
  return (
    <div className={`flex flex-col gap-1 rounded-item border bg-surface-raised p-3 ${colour}`}>
      <p className="flex items-center gap-2 text-base font-medium">
        {icon}
        {title}
      </p>
      <p className="text-sm text-text-secondary">{children}</p>
    </div>
  );
}
