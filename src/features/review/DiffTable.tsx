import { coverageLabel } from "@/contracts";
import type { Coverage, Review } from "@/contracts";
import { cn } from "@/lib/utils";
import type { CodeToken } from "./highlightHunks";
import { isLineHighlighted } from "./reviewModel";
import type { HighlightedLines } from "./reviewModel";

type Hunk = Review["hunks"][number];

// The coverage bar at the left edge of every row; the same look as CoverageMark's bar.
const GUTTER: Record<Coverage, string> = {
  read: "border-solid border-coverage-read",
  supported: "border-dashed border-coverage-supported",
  verified: "border-solid border-coverage-verified",
};

const LINE_TINT = {
  context: "",
  add: "bg-green/10",
  del: "bg-rose/10",
} as const;

const SIGN = { context: " ", add: "+", del: "−" } as const;

/**
 * A hunk as a table: coverage bar, old and new line numbers, the +/− marker
 * and the highlighted code. Whether long lines wrap is decided by the box
 * around it (`Console`), which sets `white-space` and this table inherits it.
 *
 * @param tokens Highlighted lines from the server; plain text when absent.
 * @param highlightedLines Lines to mark, e.g. those a selected claim cites.
 * @param isCompact Drops the old line numbers, for the narrow read-only view.
 */
export function DiffTable({
  hunk,
  coverage,
  tokens,
  highlightedLines,
  isCompact = false,
}: {
  hunk: Hunk;
  coverage: Coverage;
  tokens?: CodeToken[][];
  highlightedLines: HighlightedLines[];
  isCompact?: boolean;
}) {
  return (
    <table className="w-full border-collapse text-sm" aria-label={`${coverageLabel[coverage]} hunk in ${hunk.file}`}>
      <tbody>
        {hunk.lines.map((line, index) => {
          const isHighlighted = isLineHighlighted(hunk, line, highlightedLines);
          return (
            <tr
              key={index}
              data-highlighted={isHighlighted || undefined}
              className={cn(LINE_TINT[line.kind], isHighlighted && "bg-link/20 outline outline-1 -outline-offset-1 outline-link")}
            >
              <td aria-hidden="true" className={cn("w-0 border-l-2 p-0", GUTTER[coverage])} />
              {!isCompact && <td className="w-10 px-2 text-right text-xs text-text-faint select-none">{line.oldLine}</td>}
              <td className="w-10 px-2 text-right text-xs text-text-faint select-none">{line.newLine}</td>
              <td className="w-4 text-center text-text-muted select-none">
                <span className="sr-only">{line.kind === "add" ? "added" : line.kind === "del" ? "removed" : "unchanged"}</span>
                <span aria-hidden="true">{SIGN[line.kind]}</span>
              </td>
              <td className="pr-3 pl-1">
                <Code text={line.text} tokens={tokens?.[index]} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Code({ text, tokens }: { text: string; tokens?: CodeToken[] }) {
  if (!tokens || tokens.length === 0) return <>{text}</>;
  return (
    <>
      {tokens.map((token, index) => (
        <span key={index} style={token.color ? { color: token.color } : undefined}>
          {token.content}
        </span>
      ))}
    </>
  );
}
