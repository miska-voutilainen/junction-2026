import { type Diagram, MARGIN, node, path, secondaryLine, text } from "../svg";

const ROLE_WIDTH = 240;
const ROLE_GAP = 40;
const ROLE_TOP = 56;
const ROLE_HEIGHT = 72;
const RULE_TOP = 168;

// Left to right in the order a change passes through them; `rule` is what that role may not do.
const ROLES = [
  {
    title: "Authoring agent",
    lines: ["writes the code", "and its own tests"],
    rule: ["Its test makes a claim", "Supported at most"],
    cssClass: "node",
  },
  {
    title: "AI reviewer",
    lines: ["checks the claims,", "drafts the receipt"],
    rule: ["Never signs", "and never sees the answer keys"],
    cssClass: "node",
  },
  {
    title: "Named person",
    lines: ["reads what is left", "and signs with their key"],
    rule: ["Only a person's key", "makes the receipt valid"],
    cssClass: "node-acc",
  },
];

/** Idea 8: the three roles on every change, and the one thing each is not allowed to do. */
export function separationOfDuties(): Diagram {
  const roleX = ROLES.map((_, i) => MARGIN + i * (ROLE_WIDTH + ROLE_GAP));
  const lastRole = ROLES.length - 1;
  const body: string[] = [
    text(MARGIN, 34, "Three different roles on every change", "h"),
  ];

  ROLES.forEach(({ title, lines, rule, cssClass }, i) => {
    const x = roleX[i];
    body.push(
      node(
        x,
        ROLE_TOP,
        ROLE_WIDTH,
        ROLE_HEIGHT,
        title,
        lines.map(secondaryLine),
        cssClass,
      ),
    );
    if (i < lastRole)
      body.push(
        path(
          `M${x + ROLE_WIDTH + 2},${ROLE_TOP + ROLE_HEIGHT / 2} L${roleX[i + 1] - 3},${ROLE_TOP + ROLE_HEIGHT / 2}`,
          "la",
          "a",
        ),
      );
    body.push(
      text(x, RULE_TOP, "The rule", "s"),
      text(x, RULE_TOP + 20, rule[0], "t"),
      text(x, RULE_TOP + 38, rule[1], "t"),
    );
  });

  body.push(
    text(
      MARGIN,
      270,
      "Whoever plants the bugs that measure the reviewer never sees its prompts.",
      "s",
    ),
  );
  return {
    name: "separation-of-duties",
    height: 296,
    title: "The author never checks its own work",
    desc:
      "Three roles left to right: the authoring agent writes the code and its own tests, and its test makes a claim Supported at most; " +
      "the AI reviewer checks the claims and drafts the receipt, and never signs; a named person reads what is left and signs, " +
      "and only a person's key makes the receipt valid. Whoever plants the measuring bugs never sees the reviewer's prompts.",
    body,
  };
}
