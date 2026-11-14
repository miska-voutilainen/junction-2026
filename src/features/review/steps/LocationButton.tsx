"use client";

/**
 * A place in the code as a button, "TypeCollector.cs:737–740": pressing it
 * brings those lines into view in the diff. A button, not a link, because it
 * changes what the page shows instead of going anywhere.
 */
export function LocationButton({ label, onShow }: { label: string; onShow: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Show ${label} in the diff`}
      onClick={onShow}
      className="rounded-chip py-0.5 text-left font-mono text-xs break-all text-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring"
    >
      {label}
    </button>
  );
}
