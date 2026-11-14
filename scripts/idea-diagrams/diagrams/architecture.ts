/**
 * The architecture of docs/architecture.md: two halves that never meet at
 * runtime. Everything that needs git, .NET or a model runs on a laptop and
 * writes files into data/; a static site only reads those files. The routing
 * rules (P3) are the one piece of code both halves import. Spec section 1.
 */
import {
  codeLine,
  type Diagram,
  MARGIN,
  label,
  node,
  path,
  rect,
  secondaryLine,
  text,
} from "../svg";

const REGION_LEFT = MARGIN;
const REGION_WIDTH = 816;
const NODE_HEIGHT = 64;

// Where the laptop's top row sits, so the arrows below can start at its edges.
const LAPTOP_TOP = 16;
const LAPTOP_BOTTOM = 212;
const ROW_Y = 50;
const MODEL_ROW_Y = 140;

const DATA_Y = 262;
const DATA_HEIGHT = 60;
const SITE_TOP = 352;
const APP_Y = 386;

/** The architecture: laptop half, committed data/ files, static site, and the routing rules both sides share. */
export function architecture(): Diagram {
  const body: string[] = [
    ...laptopRegion(),
    ...dataAndRules(),
    ...siteRegion(),
    text(
      MARGIN,
      508,
      "The halves meet only through committed files in data/. P3 is the same pure code on both sides.",
      "secondary",
    ),
  ];
  return {
    name: "architecture",
    height: 532,
    title: "Countersign architecture",
    desc:
      "A laptop half runs the review pipeline (P2) over our fork of Tieto's repository (P1), with the Claude model and the .NET SDK, plus the planted-bug eval (P4) and the receipt CLI (P5). " +
      "It writes committed files into data/. A static site on Vercel with no server and no database, the review app (P6) with simulated escapes in browser storage, reads those files. " +
      "The routing rules (P3, no AI) are imported by the pipeline and re-run in the browser.",
    body,
  };
}

function laptopRegion(): string[] {
  return [
    rect(REGION_LEFT, LAPTOP_TOP, REGION_WIDTH, LAPTOP_BOTTOM - LAPTOP_TOP, "node-dash", 8),
    text(MARGIN + 16, 38, "Laptop (operator's machine)", "heading"),
    node(48, ROW_Y, 170, NODE_HEIGHT, "P1 · Demo data", [
      secondaryLine("our fork of Tieto's repo"),
      codeLine("+ data/sample"),
    ]),
    node(242, ROW_Y, 262, NODE_HEIGHT, "P2 · Review pipeline", [
      secondaryLine("A1–A5, quote check, .NET tests"),
    ]),
    node(524, ROW_Y, 150, NODE_HEIGHT, "P4 · Measurement", [secondaryLine("planted-bug eval")]),
    node(694, ROW_Y, 138, NODE_HEIGHT, "P5 · Receipt CLI", [
      codeLine("ssh-keygen"),
      secondaryLine("+ git notes"),
    ]),
    // P1 feeds P2 directly; P4 and P5 read the same fork, shown by the P1 text.
    path("M220,82 L239,82"),
    path("M506,82 L521,82"),
    // Plain links: the pipeline both calls and receives from the model and the .NET SDK.
    path("M312,114 L312,140", "ln", null),
    path("M440,114 L440,140", "ln", null),
    node(242, MODEL_ROW_Y, 140, 52, "Claude", [
      codeLine("claude-opus-5-5"),
      secondaryLine("record / replay"),
    ]),
    node(392, MODEL_ROW_Y, 112, 52, ".NET SDK", [codeLine("8.0.4xx")]),
  ];
}

function dataAndRules(): string[] {
  return [
    path(`M300,${LAPTOP_BOTTOM + 2} L300,${DATA_Y - 3}`, "la", "accent"),
    label(312, 242, "writes JSON: pnpm review, evals, countersign", "secondary", "start"),
    node(
      REGION_LEFT,
      DATA_Y,
      608,
      DATA_HEIGHT,
      "Committed files in data/",
      [codeLine("runs · eval · receipts · recordings")],
      "node-amber",
      "tint-amber",
    ),
    node(
      668,
      DATA_Y,
      180,
      DATA_HEIGHT,
      "P3 · Routing rules",
      [secondaryLine("src/rules, no AI")],
      "node-acc",
      "tint-acc",
    ),
    // The pipeline imports P3 to decide a tier; the app re-runs the same code.
    // The elbow runs through the gap right of P2 so the arrowhead lands on P2, not P5.
    path(`M758,${DATA_Y - 2} L758,170 L516,170 L516,100 L506,100`, "la", "accent"),
    label(640, 164, "imported by P2"),
  ];
}

function siteRegion(): string[] {
  return [
    rect(REGION_LEFT, SITE_TOP, REGION_WIDTH, 126, "node-dash", 8),
    text(MARGIN + 16, 374, "Static site on Vercel (no server, no database)", "heading"),
    path(`M480,${DATA_Y + DATA_HEIGHT + 2} L480,${APP_Y - 3}`, "la", "accent"),
    label(468, 346, "read when the site is built", "secondary", "end"),
    node(48, APP_Y, 540, 76, "P6 · Review app", [
      secondaryLine("S1 inbox · S2 review · S3 report card"),
      secondaryLine("S4 receipt · S5 dashboard"),
    ]),
    node(612, APP_Y, 220, 76, "Simulated escapes", [secondaryLine("browser storage")]),
    path("M590,424 L610,424", "ln", null),
    // P3 reaches the app by its own route: it is code, not a data file.
    path(`M740,${DATA_Y + DATA_HEIGHT + 2} L740,345 L560,345 L560,${APP_Y - 3}`, "la", "accent"),
    label(650, 338, "re-run in the browser", "secondary"),
  ];
}
