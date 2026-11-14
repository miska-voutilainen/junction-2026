/** The receipt CLI verbs a change can be taken through. */
type CountersignVerb = "draft" | "sign" | "verify" | "export";

/** The shell command for one receipt step, e.g. `countersignCommand("sign", "mp-2283")` is "pnpm countersign sign mp-2283". */
export function countersignCommand(verb: CountersignVerb, changeId: string): string {
  return `pnpm countersign ${verb} ${changeId}`;
}
