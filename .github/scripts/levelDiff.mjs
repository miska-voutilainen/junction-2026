// Trust ladder in CI: compares the report card a prompt or policy change produced with the committed
// one and says which areas moved. A change that lowers an area's level fails the check, so a prompt
// edit cannot quietly cost the reviewer trust the planted-bug eval had earned. Raising a level, or
// no change, passes. Spec section 5, Ladder.
//
// Usage: node .github/scripts/levelDiff.mjs <before.json> <after.json>
// Prints a Markdown table (the workflow appends it to the job summary); exit 1 on a drop.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const RUNGS = ["shadow", "calibrated", "trusted"];

/**
 * Compares two report cards area by area.
 * @param {{areas: {area: string, level: string, planted: number, caught: number}[]}} before
 * @param {{areas: {area: string, level: string, planted: number, caught: number}[]}} after
 * @returns {{rows: {area: string, from: string, to: string, caught: string, isDrop: boolean}[], hasDrop: boolean}}
 * @example compareLevels(committed, rerun).rows[0] // { area: "security", from: "calibrated", to: "shadow", caught: "1 of 3", isDrop: true }
 */
export function compareLevels(before, after) {
  const levelBefore = new Map(before.areas.map((entry) => [entry.area, entry.level]));
  const rows = after.areas.map((entry) => {
    // An area the committed card does not list had no track record: Shadow.
    const from = levelBefore.get(entry.area) ?? "shadow";
    return {
      area: entry.area,
      from,
      to: entry.level,
      caught: `${entry.caught} of ${entry.planted}`,
      isDrop: RUNGS.indexOf(entry.level) < RUNGS.indexOf(from),
    };
  });
  return { rows, hasDrop: rows.some((row) => row.isDrop) };
}

/** The table the job summary shows. */
export function renderLevelTable({ rows, hasDrop }) {
  const lines = [
    "| Area | Planted bugs caught | Level before | Level after |",
    "| --- | --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${row.area} | ${row.caught} | ${row.from} | ${row.to}${row.isDrop ? " (dropped)" : ""} |`,
    ),
  ];
  if (hasDrop)
    lines.push(
      "",
      "This change lowers an area's level. Improve the prompt or policy, or accept the drop in review and commit the new report card.",
    );
  return lines.join("\n");
}

function main() {
  const [beforePath, afterPath] = process.argv.slice(2);
  if (!beforePath || !afterPath) {
    console.error("Usage: node .github/scripts/levelDiff.mjs <before.json> <after.json>");
    process.exit(2);
  }
  const result = compareLevels(
    JSON.parse(readFileSync(beforePath, "utf8")),
    JSON.parse(readFileSync(afterPath, "utf8")),
  );
  console.log(renderLevelTable(result));
  if (result.hasDrop) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
