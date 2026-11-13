/**
 * Notice under the top bar when a page shows data from `data/fixtures/`.
 * Pages render it when any loader result has `source: "fixture"` (spec section 3).
 */
export function MockDataBanner() {
  return (
    <div role="status" className="bg-surface-panel border-b border-border-subtle text-text-muted text-sm px-4 py-2">
      Showing mock data
    </div>
  );
}
