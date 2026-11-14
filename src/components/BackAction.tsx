import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The one way out of an empty or not-found screen: a secondary button with a
 * back arrow, so the receipt's empty state and the 404 pages offer it alike.
 *
 * @param href Where the reader goes back to.
 * @param children The destination in words, e.g. "Back to the inbox".
 */
export function BackAction({ href, children }: Readonly<{ href: string; children: string }>) {
  return (
    <Button asChild variant="secondary">
      <Link href={href}>
        <ArrowLeft aria-hidden="true" />
        {children}
      </Link>
    </Button>
  );
}
