/**
 * The seal on a signed receipt: "Signature verified" with a ringed check. It
 * is the one place green appears in the product (tokens.css), so it only draws
 * for a receipt whose signature verified for this diff. It pulses once when
 * the page opens; the global reduced-motion rule switches the pulse off.
 *
 * @param size The drawing's width and height in pixels.
 */
export function ReceiptSeal({ size = 64 }: Readonly<{ size?: number }>) {
  return (
    <div className="flex flex-none flex-col items-center gap-1.5">
      <span className="rounded-full text-green motion-safe:animate-[unlock-pulse_900ms_var(--ease-out)_1]">
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="32" cy="32" r="24" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 3" />
          <path d="M22 33l7 7 14-15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="text-xs text-green-light">Signature verified</span>
    </div>
  );
}
