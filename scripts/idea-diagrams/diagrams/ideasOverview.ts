import { badge, type Diagram, MARGIN, node, path, secondaryLine, text } from "../svg";

const STAGE_WIDTH = 120;
const STAGE_GAP = 19;
const STAGE_TOP = 150;
const STAGE_HEIGHT = 64;

// Left to right along one pull request; `idea` is the number of the idea page.
const STAGES = [
  { title: "Expectation", subtitle: "from the requirement", idea: 2, ideaName: "Blind-first" },
  { title: "Claims", subtitle: "cite the code", idea: 4, ideaName: "Quote check" },
  { title: "Refusals", subtitle: "7 written rules", idea: 5, ideaName: "Refusal policy" },
  { title: "Tests on", subtitle: "base and head", idea: 6, ideaName: "Evidence levels" },
  { title: "route()", subtitle: "coverage per hunk", idea: 3, ideaName: "Coverage map" },
  { title: "Owner signs", subtitle: "a git note", idea: 7, ideaName: "Signed receipt" },
];

/** The seven ideas placed along one pull request, with the trust ladder feeding route(). */
export function ideasOverview(): Diagram {
  const stageX = STAGES.map((_, i) => MARGIN + i * (STAGE_WIDTH + STAGE_GAP));
  const lastStage = STAGES.length - 1;
  const body: string[] = [text(MARGIN, 34, "One agent-written pull request, left to right", "h")];

  STAGES.forEach(({ title, subtitle, idea, ideaName }, i) => {
    const x = stageX[i];
    body.push(node(x, STAGE_TOP, STAGE_WIDTH, STAGE_HEIGHT, title, [secondaryLine(subtitle)], i === lastStage ? "node-acc" : "node"));
    if (i < lastStage) body.push(path(`M${x + STAGE_WIDTH + 2},182 L${stageX[i + 1] - 3},182`, "la", "a"));
    body.push(badge(x + 22, 248, idea), text(x + 38, 252, ideaName, "t"));
  });

  // The ladder spans two columns and feeds route(), the fifth stage.
  body.push(
    node(stageX[3], 56, STAGE_WIDTH * 2 + STAGE_GAP, 52, "Trust ladder per area", [secondaryLine("planted bugs, measured offline")], "node-amber", "tint-amber"),
  );
  body.push(path(`M${stageX[4] + 60},110 L${stageX[4] + 60},147`, "ln"));
  body.push(badge(stageX[3] - 26, 82, 1));

  body.push(text(MARGIN, 296, "Ideas 2, 4, 5 and 6 build the evidence; 1 and 3 decide what a person reads; 7 makes the person accountable.", "s"));
  return {
    name: "ideas-overview",
    height: 320,
    title: "The seven ideas along one pull request",
    desc:
      "Six stages left to right: expectation from the requirement (idea 2), claims that cite code (idea 4), refusals (idea 5), " +
      "tests on base and head (idea 6), route() coverage per hunk (idea 3), the owner signs a git note (idea 7). " +
      "The trust ladder (idea 1), measured offline on planted bugs, feeds route().",
    body,
  };
}
