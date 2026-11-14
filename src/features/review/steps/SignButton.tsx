"use client";

import { Kbd } from "@/components/ui/kbd";
import { useReviewStep } from "./ReviewStep";
import { isSignable, signActionLabel } from "./stepsModel";
import type { SignState } from "./stepsModel";

/**
 * The header's primary Sign button with its `4` key hint (a visual hint only: the button's name is its action label and `aria-keyshortcuts` announces the key). It opens step 4,
 * where the sign command is: the site cannot sign. Shown from 760 px, and
 * only when there is something to sign; a signed change has the "View full
 * receipt" link instead, and an unreadable receipt file has nothing to sign.
 */
export function SignButton({ signState }: Readonly<{ signState: SignState }>) {
  const { openStep } = useReviewStep();
  if (!isSignable(signState)) return null;
  return (
    <button
      type="button"
      onClick={() => openStep("sign")}
      aria-keyshortcuts="4"
      className="hidden items-center gap-2 rounded-button bg-brand py-2 pr-2.5 pl-4 text-sm font-semibold text-primary-foreground transition-colors duration-(--duration-fast) hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring-on-brand compact:inline-flex"
    >
      {signActionLabel(signState)}
      <Kbd aria-hidden="true" className="bg-primary-foreground/15 text-primary-foreground">4</Kbd>
    </button>
  );
}
