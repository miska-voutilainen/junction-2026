const SIGNED_AT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

/**
 * "13 Nov 2026, 17:22 UTC": the one format for a signing time on the Review
 * page and the receipt page. UTC is fixed so the server's HTML and the
 * browser's agree; a local zone would flash a different time on hydration.
 */
export function formatSignedAt(isoTimestamp: string): string {
  return `${SIGNED_AT.format(new Date(isoTimestamp))} UTC`;
}
