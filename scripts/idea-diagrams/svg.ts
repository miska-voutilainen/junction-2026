/**
 * SVG building blocks shared by every idea diagram: the two colour themes, the
 * style sheet, arrowhead markers and the drawing primitives. System fonts only,
 * because GitHub renders SVGs in an image context that cannot load web fonts.
 */

import type { IdeaNumber } from "../../src/lib/ideaLinks";

/** Canvas width of every diagram; heights differ per diagram. */
export const CANVAS_WIDTH = 880;

/** Left edge of content, the same on every diagram. */
export const MARGIN = 32;

/** What one diagram supplies; `body` is the SVG elements inside the frame. */
export interface Diagram {
  name: string;
  height: number;
  title: string;
  desc: string;
  body: string[];
}

/** A line of node text: the text and the CSS class that styles it. */
export type TextLine = readonly [text: string, cssClass: string];

/** Secondary text line (muted colour). */
export const secondaryLine = (content: string): TextLine => [content, "secondary"];

/** Code or identifier text line (monospace). */
export const codeLine = (content: string): TextLine => [content, "code"];

/** One colour set; every diagram is drawn once per theme. */
export interface Theme {
  bg: string;
  panel: string;
  border: string;
  hair: string;
  text: string;
  sec: string;
  muted: string;
  brand: string;
  accent: string;
  amber: string;
  rose: string;
}

/** Text on a brand-coloured fill (the badge numbers): the app's text-on-brand role. */
const TEXT_ON_BRAND = "#ffffff";

/**
 * The dark set mirrors `src/styles/tokens.css`. The light set is picked for
 * AA contrast on white, since GitHub shows the SVG on the reader's theme.
 */
export const THEMES: Record<"dark" | "light", Theme> = {
  dark: {
    bg: "#0d0f12",
    panel: "#111418",
    border: "#2a3038",
    hair: "#262c34",
    text: "#e6e8eb",
    sec: "#c4cad3",
    muted: "#9aa3af",
    brand: "#3558e8",
    accent: "#93aaff",
    amber: "#e2b04a",
    rose: "#ef7a85",
  },
  light: {
    bg: "#ffffff",
    panel: "#f6f8fa",
    border: "#c9d1d9",
    hair: "#d8dee4",
    text: "#1f2328",
    sec: "#3d444d",
    muted: "#59636e",
    brand: "#3558e8",
    accent: "#2f4fd6",
    amber: "#8a5a00",
    rose: "#c4232e",
  },
};

// Already XML-escaped, because they are pasted into a style sheet inside the SVG.
const SANS_FONTS =
  "-apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, &quot;Noto Sans&quot;, Helvetica, Arial, sans-serif";
const MONO_FONTS =
  "ui-monospace, SFMono-Regular, &quot;SF Mono&quot;, Menlo, Consolas, &quot;Liberation Mono&quot;, monospace";

function styleSheet(c: Theme): string {
  return `
.frame{fill:${c.bg};stroke:${c.hair};stroke-width:1}
.node{fill:${c.panel};stroke:${c.border};stroke-width:1.5}
.node-acc{fill:${c.panel};stroke:${c.accent};stroke-width:1.5}
.tint-acc{fill:${c.brand};fill-opacity:.16}
.tint-acc2{fill:${c.brand};fill-opacity:.24}
.node-amber{fill:${c.panel};stroke:${c.amber};stroke-width:1.5}
.tint-amber{fill:${c.amber};fill-opacity:.12}
.node-rose{fill:${c.panel};stroke:${c.rose};stroke-width:1.5;stroke-dasharray:5 4}
.node-dash{fill:none;stroke:${c.border};stroke-width:1.5;stroke-dasharray:5 4}
text{font-family:${SANS_FONTS};font-size:12px;fill:${c.muted}}
.title{font-size:13px;font-weight:600;fill:${c.text}}
.heading{font-size:14px;font-weight:600;fill:${c.text}}
.secondary{fill:${c.muted}}
.code{font-family:${MONO_FONTS};fill:${c.sec}}
.accent-text{fill:${c.accent}}.rose-text{fill:${c.rose}}
.ln{stroke:${c.muted};stroke-width:1.5;fill:none}
.la{stroke:${c.accent};stroke-width:2;fill:none}
.lr{stroke:${c.rose};stroke-width:1.5;fill:none;stroke-dasharray:5 4}
.head-neutral{fill:${c.muted}}.head-accent{fill:${c.accent}}.head-rose{fill:${c.rose}}
.badge-dot{fill:${c.brand}}.badge-number{fill:${TEXT_ON_BRAND};font-size:12px;font-weight:600}
.strike{stroke:${c.rose};stroke-width:1.5}
`;
}

// One arrowhead per line colour, filled by the matching .head-* class.
const ARROW_HEADS = ["neutral", "accent", "rose"] as const;

/** Colour of an arrowhead: the line colours `neutral`, `accent` and `rose`. */
export type ArrowHead = (typeof ARROW_HEADS)[number];
const MARKERS = ARROW_HEADS.map(
  (head) =>
    `<marker id="ah-${head}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" ` +
    `orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="head-${head}"/></marker>`,
).join("");

/** Escapes the five XML special characters with fixed entities, so re-running the generator writes identical bytes. */
function escapeXml(content: string): string {
  return content
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}

/** Wraps a diagram's body in the frame, style sheet and accessible title for one theme. */
export function renderDocument(diagram: Diagram, theme: Theme): string {
  const { name, height, title, desc, body } = diagram;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${height}" width="${CANVAS_WIDTH}" height="${height}" ` +
    `role="img" aria-labelledby="${name}-t ${name}-d">` +
    `<title id="${name}-t">${escapeXml(title)}</title><desc id="${name}-d">${escapeXml(desc)}</desc>` +
    `<style>${styleSheet(theme)}</style><defs>${MARKERS}</defs>` +
    `<rect class="frame" x="0.5" y="0.5" width="${CANVAS_WIDTH - 1}" height="${height - 1}" rx="8"/>` +
    body.join("") +
    "</svg>\n"
  );
}

/** A rectangle; `cssClass` picks the border and fill style, `rx` the corner radius. */
export function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  cssClass = "node",
  rx = 6,
): string {
  return `<rect class="${cssClass}" x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}"/>`;
}

/** A text element; `anchor` is the SVG text-anchor (start is the default and left out). */
export function text(
  x: number,
  y: number,
  content: string,
  cssClass = "",
  anchor = "start",
): string {
  const anchorAttribute = anchor !== "start" ? ` text-anchor="${anchor}"` : "";
  const classAttribute = cssClass ? ` class="${cssClass}"` : "";
  return `<text x="${x}" y="${y}"${classAttribute}${anchorAttribute}>${escapeXml(content)}</text>`;
}

// Title line height, and the height of each extra line, inside a node.
const NODE_TITLE_HEIGHT = 16;
const NODE_LINE_HEIGHT = 17;
// Gap between a node's left edge and its text.
const NODE_TEXT_INSET = 14;
// Distance from the top of the text block to the title's baseline: the title's ascent.
const NODE_TITLE_BASELINE = 13;
// Distance from the title's baseline to the first secondary line's baseline.
const NODE_FIRST_LINE_OFFSET = 18;

/**
 * A rectangle with a bold title and secondary lines, vertically centred.
 * The text starts NODE_TEXT_INSET px from the left edge.
 */
export function node(
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  lines: readonly TextLine[] = [],
  cssClass = "node",
  tint?: string,
): string {
  const parts = [rect(x, y, width, height, cssClass)];
  if (tint) parts.push(rect(x, y, width, height, tint));
  const textX = x + NODE_TEXT_INSET;
  const blockHeight = NODE_TITLE_HEIGHT + NODE_LINE_HEIGHT * lines.length;
  const titleY = y + (height - blockHeight) / 2 + NODE_TITLE_BASELINE;
  parts.push(text(textX, titleY, title, "title"));
  lines.forEach(([content, lineClass], index) => {
    const lineY = titleY + NODE_FIRST_LINE_OFFSET + NODE_LINE_HEIGHT * index;
    parts.push(text(textX, lineY, content, lineClass));
  });
  return parts.join("");
}

/** A path with an arrowhead of the given colour (`neutral`, `accent`, `rose`); pass `null` for none. */
export function path(d: string, cssClass = "ln", head: ArrowHead | null = "neutral"): string {
  const marker = head ? ` marker-end="url(#ah-${head})"` : "";
  return `<path class="${cssClass}" d="${d}"${marker}/>`;
}

/** A short text next to an arrow, centred on its x by default. */
export function label(
  x: number,
  y: number,
  content: string,
  cssClass = "secondary",
  anchor = "middle",
): string {
  return text(x, y, content, cssClass, anchor);
}

/** A numbered circle that points at one of the eight ideas. */
export function badge(centerX: number, centerY: number, ideaNumber: IdeaNumber): string {
  return (
    `<circle class="badge-dot" cx="${centerX}" cy="${centerY}" r="10"/>` +
    text(centerX, centerY + 4, String(ideaNumber), "badge-number", "middle")
  );
}
