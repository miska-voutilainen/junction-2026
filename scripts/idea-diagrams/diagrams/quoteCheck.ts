import { codeLine, type Diagram, label, MARGIN, node, path, rect, secondaryLine, text } from "../svg";

const ROW_Y = 48;
const NODE_HEIGHT = 72;
const MIDDLE_Y = ROW_Y + NODE_HEIGHT / 2;

// Written as the characters a reader sees, one example per normalising rule.
const NORMALISING_RULES = ["\\r\\n  →  \\n", "whitespace runs  →  one space", "trim; case stays significant"];

/** Idea 4: how a claim's quote is matched against the cited lines, with no model call. */
export function quoteCheck(): Diagram {
  const body: string[] = [];
  body.push(node(MARGIN, ROW_Y, 180, NODE_HEIGHT, "A claim cites code", [codeLine("file · side · lines"), codeLine("quote")]));
  body.push(path(`M214,${MIDDLE_Y} L249,${MIDDLE_Y}`, "ln"));
  body.push(node(252, ROW_Y, 200, NODE_HEIGHT, "Normalise both", [secondaryLine("the quote and the cited"), secondaryLine("lines, the same way")]));
  body.push(path(`M454,${MIDDLE_Y} L489,${MIDDLE_Y}`, "ln"));
  body.push(node(492, ROW_Y, 170, NODE_HEIGHT, "Quote found in", [secondaryLine("the cited lines?")]));
  body.push(path(`M664,${MIDDLE_Y} L709,${MIDDLE_Y}`, "la", "a"), label(686, ROW_Y + 28, "yes", "ta"));
  body.push(rect(712, ROW_Y, 136, NODE_HEIGHT, "node-acc"), rect(712, ROW_Y, 136, NODE_HEIGHT, "tint-acc"));
  body.push(text(780, ROW_Y + 32, "Supported", "t", "middle"), text(780, ROW_Y + 50, "shown with quote", "s", "middle"));

  const failureTop = ROW_Y + NODE_HEIGHT + 62;
  body.push(path(`M577,${ROW_Y + NODE_HEIGHT + 2} L577,${ROW_Y + NODE_HEIGHT + 58}`, "lr", "r"));
  body.push(label(589, ROW_Y + NODE_HEIGHT + 32, "no", "tr", "start"));
  body.push(rect(492, failureTop, 356, 64, "node-rose"));
  body.push(text(508, failureTop + 26, "Unverified: shown without citations", "t"));
  body.push(text(508, failureTop + 44, "A finding with no passing citation is dropped.", "s"));

  body.push(text(MARGIN, 176, "Normalising", "t"));
  NORMALISING_RULES.forEach((rule, index) => body.push(text(MARGIN, 198 + 18 * index, rule, "c")));
  body.push(text(MARGIN, 290, "Every failure is counted: quotes checked, quote failures, claims downgraded, findings dropped. No model call.", "s"));
  return {
    name: "quote-check",
    height: 314,
    title: "Mechanical quote check",
    desc:
      "A claim's citation and the cited lines are normalised the same way, then the quote is searched for in the cited lines. " +
      "Found: the claim is Supported. Not found: the claim is Unverified and shown without citations; a finding with no passing citation is dropped. Every failure is counted.",
    body,
  };
}
