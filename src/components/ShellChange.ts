/** What the shell needs to know about a change: the nav badge and the command menu rows. */
export type ShellChange = {
  id: string;
  title: string;
  requirementId: string;
  /** "Light", "Focused" or "Full"; null while the change has no routing yet. */
  tierLabel: string | null;
  /** The receipt status in words, e.g. "needs review". */
  statusLabel: string;
  needsReview: boolean;
};
