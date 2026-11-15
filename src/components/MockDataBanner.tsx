/**
 * Notice under the top bar when a page shows data from `data/fixtures/`.
 * Pages render it when any loader result has `source: "fixture"` (spec section 3).
 */
export function MockDataBanner() {
  return (
    <div
      role="status"
      className="border-b border-border-subtle bg-surface-panel px-4 py-2 text-sm text-text-muted"
    >
      Showing mock data
    </div>
  );
}
