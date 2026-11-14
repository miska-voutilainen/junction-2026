import { RolesLine } from "@/components/RolesLine";
import type { IdentityRow, ReceiptDocumentView } from "./receiptModel";

/**
 * What the signature is bound to: commit, base, the diff hash, repo, reviewer
 * run and signer. Ids and hashes are mono and break anywhere, so a 64-character
 * hash wraps inside its row at 320 px; labels sit above values below 760 px.
 * The last row is the roles line (idea 8): author, reviewer and signer in
 * sans, since they are names rather than ids.
 */
export function IdentityList({ rows, roles }: { rows: IdentityRow[]; roles: ReceiptDocumentView["roles"] }) {
  return (
    <dl className="m-0 grid grid-cols-1 gap-x-4 gap-y-1 border-y border-border-subtle py-4 font-mono text-sm text-text-secondary compact:grid-cols-[7rem_minmax(0,1fr)] compact:gap-y-1.5">
      {rows.map(({ label, value }) => (
        <div key={label} className="contents">
          <dt className="mt-2 text-text-faint first:mt-0 compact:mt-0">{label}</dt>
          <dd className="m-0 min-w-0 break-all">{value}</dd>
        </div>
      ))}
      <dt className="mt-2 text-text-faint compact:mt-0">roles</dt>
      <dd className="m-0 min-w-0 font-sans">
        <RolesLine {...roles} />
      </dd>
    </dl>
  );
}
