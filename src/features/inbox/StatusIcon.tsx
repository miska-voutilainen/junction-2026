import type { ReactNode } from "react";
import { Check, Minus, ShieldX, TriangleAlert } from "lucide-react";
import { isReviewed } from "./inboxModel";
import type { InboxRow } from "./inboxModel";

function statusOf(row: InboxRow): { label: string; icon: ReactNode } {
  if (!isReviewed(row)) {
    return row.state === "missing"
      ? { label: "Not reviewed", icon: <Minus className="size-4 text-text-muted" /> }
      : { label: "Review unreadable", icon: <TriangleAlert className="size-4 text-rose-light" /> };
  }
  if (row.receipt === "signed")
    return { label: "Signed", icon: <Check className="size-4 text-text-secondary" /> };
  if (row.receipt === "stale")
    return { label: "Stale", icon: <TriangleAlert className="size-4 text-amber-light" /> };
  if (row.receipt === "reopened")
    return {
      label: "Reopened by an escape",
      icon: <TriangleAlert className="size-4 text-amber-light" />,
    };
  if (row.receipt === "unverified")
    return {
      label: "Signature failed verification",
      icon: <ShieldX className="size-4 text-rose-light" />,
    };
  return { label: "Needs review", icon: <span className="size-2 rounded-full bg-link" /> };
}

/** Receipt state of a row as a small icon with a label: needs review (dot), signed (check), stale or reopened by an escape (triangle), failed verification (shield with a cross). */
export function StatusIcon({ row }: Readonly<{ row: InboxRow }>) {
  const { label, icon } = statusOf(row);
  return (
    <span role="img" aria-label={label} className="grid size-4 place-items-center">
      {icon}
    </span>
  );
}
