const SIZES = {
  lg: { text: "text-[28px]", logoWidth: 44, logoHeight: 35 },
  sm: { text: "text-base", logoWidth: 25, logoHeight: 20 },
} as const;

/**
 * The Countersign logo and name. Read by screen readers as one "Countersign",
 * so the drawing and the lettering are hidden from them separately.
 *
 * @param size "lg" for full-page use such as the gate, "sm" for the top bar.
 * @param showName False shows the mark alone, for the mobile header where the page title sits next to it.
 */
export function Wordmark({ size = "lg", showName = true }: { size?: keyof typeof SIZES; showName?: boolean }) {
  const { text, logoWidth, logoHeight } = SIZES[size];
  return (
    <span
      role="img"
      aria-label="Countersign"
      className="inline-flex items-center gap-3"
    >
      <svg
        width={logoWidth}
        height={logoHeight}
        viewBox="0 0 30 24"
        fill="none"
        aria-hidden="true"
      >
        <rect x="1" y="3" width="13" height="3.2" rx="1.6" fill="var(--logo-muted)" />
        <rect x="1" y="10.4" width="17.5" height="3.2" rx="1.6" fill="var(--logo-strong)" />
        <rect x="1" y="17.8" width="10" height="3.2" rx="1.6" fill="var(--logo-muted)" />
        <path
          d="M21.5 1.6c2.6 0 3.2 1.1 3.2 3.2v3.8c0 1.6.9 2.7 2.9 3.4-2 .7-2.9 1.8-2.9 3.4v3.8c0 2.1-.6 3.2-3.2 3.2"
          stroke="var(--logo-blue)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showName && (
        <span aria-hidden="true" className={`${text} font-bold tracking-[-0.045em]`}>
          countersign
        </span>
      )}
    </span>
  );
}
