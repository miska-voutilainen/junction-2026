/**
 * Draws the diagrams of the eight idea pages (docs/ideas) into docs/ideas/img/.
 * Every diagram is described once and rendered in a light and a dark theme, so
 * the two versions cannot drift apart. Output is plain SVG with system fonts:
 * GitHub shows SVGs as images, and an image cannot load web fonts (docs.md).
 *
 * Run: pnpm tsx scripts/idea-diagrams/draw.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { blindFirst } from "./diagrams/blindFirst";
import { coverageMap } from "./diagrams/coverageMap";
import { evidenceLevels } from "./diagrams/evidenceLevels";
import { ideasOverview } from "./diagrams/ideasOverview";
import { quoteCheck } from "./diagrams/quoteCheck";
import { separationOfDuties } from "./diagrams/separationOfDuties";
import { signedReceipt } from "./diagrams/signedReceipt";
import { trustLadder } from "./diagrams/trustLadder";
import { renderDocument, THEMES } from "./svg";

const OUTPUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "docs",
  "ideas",
  "img",
);

const DIAGRAMS = [
  trustLadder,
  blindFirst,
  coverageMap,
  quoteCheck,
  evidenceLevels,
  signedReceipt,
  separationOfDuties,
  ideasOverview,
];

function drawAll(): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const drawDiagram of DIAGRAMS) {
    const diagram = drawDiagram();
    for (const [themeName, theme] of Object.entries(THEMES)) {
      writeFileSync(
        join(OUTPUT_DIR, `${diagram.name}-${themeName}.svg`),
        renderDocument(diagram, theme),
        "utf-8",
      );
    }
  }
}

drawAll();
