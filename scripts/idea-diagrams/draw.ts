/**
 * Draws the diagrams of the eight idea pages (docs/ideas) into docs/ideas/img/
 * and the architecture diagram (docs/architecture.md) into docs/img/.
 * Every diagram is described once and rendered in a light and a dark theme, so
 * the two versions cannot drift apart. Output is plain SVG with system fonts:
 * GitHub shows SVGs as images, and an image cannot load web fonts (docs.md).
 *
 * Run: pnpm tsx scripts/idea-diagrams/draw.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { architecture } from "./diagrams/architecture";
import { blindFirst } from "./diagrams/blindFirst";
import { coverageMap } from "./diagrams/coverageMap";
import { evidenceLevels } from "./diagrams/evidenceLevels";
import { ideasOverview } from "./diagrams/ideasOverview";
import { quoteCheck } from "./diagrams/quoteCheck";
import { separationOfDuties } from "./diagrams/separationOfDuties";
import { signedReceipt } from "./diagrams/signedReceipt";
import { trustLadder } from "./diagrams/trustLadder";
import { renderDocument, THEMES } from "./svg";

const DOCS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "docs",
);

const DIAGRAM_GROUPS = [
  {
    outputDir: join(DOCS_DIR, "ideas", "img"),
    diagrams: [
      trustLadder,
      blindFirst,
      coverageMap,
      quoteCheck,
      evidenceLevels,
      signedReceipt,
      separationOfDuties,
      ideasOverview,
    ],
  },
  { outputDir: join(DOCS_DIR, "img"), diagrams: [architecture] },
];

function drawAll(): void {
  for (const { outputDir, diagrams } of DIAGRAM_GROUPS) {
    mkdirSync(outputDir, { recursive: true });
    for (const drawDiagram of diagrams) {
      const diagram = drawDiagram();
      for (const [themeName, theme] of Object.entries(THEMES)) {
        writeFileSync(
          join(outputDir, `${diagram.name}-${themeName}.svg`),
          renderDocument(diagram, theme),
          "utf-8",
        );
      }
    }
  }
}

drawAll();
