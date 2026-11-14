"use client";

import { signActionLabel } from "./stepsModel";
import type { SignState } from "./stepsModel";

/** The bar's classes, shared with its spacer so the page always keeps exactly the room the bar takes, safe area included. */
export const SIGN_BAR_HEIGHT = "h-[calc(var(--layout-sign-bar)+env(safe-area-inset-bottom))]";

/**
 * The phone's bar, fixed to the bottom of the screen while the steps panel
 * sits far down the page. It opens step 4 (where the receipt, or the sign
 * command, is); it cannot sign, because signing happens in the owner's
 * terminal. From 760 px the header's Sign button and the `4` key do this
 * job, so the bar is hidden there and in print.
 */
export function SignBar({ signState, onOpenSign }: Readonly<{ signState: SignState; onOpenSign: () => void }>) {
  return (
    <div
      className={`${SIGN_BAR_HEIGHT} fixed inset-x-0 bottom-0 z-30 flex items-center border-t border-border-subtle bg-surface-panel px-4 pb-[env(safe-area-inset-bottom)] compact:hidden print:hidden`}
    >
      <button
        type="button"
        onClick={onOpenSign}
        className="h-10 w-full rounded-button bg-brand text-sm font-semibold text-primary-foreground transition-colors duration-(--duration-fast) hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring-on-brand"
      >
        {signActionLabel(signState)}
      </button>
    </div>
  );
}

/** Empty space under the page as tall as the Sign bar, so the bar never covers the last lines. */
export function SignBarSpacer() {
  return <div aria-hidden="true" className={`${SIGN_BAR_HEIGHT} compact:hidden print:hidden`} />;
}
