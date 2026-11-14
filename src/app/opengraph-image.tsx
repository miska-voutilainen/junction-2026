import { ImageResponse } from "next/og";

export const alt = "Countersign: AI reviews. A named human countersigns, on evidence they can check.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// These hex values mirror src/styles/tokens.css (--surface-bg, --text-primary,
// --text-muted) and the --logo-* values inlined in src/app/icon.svg: ImageResponse
// can't read CSS variables.
const BACKGROUND = "#0d0f12";
const FOREGROUND = "#e6e8eb";
const MUTED = "#9aa3af";
const LOGO_MUTED = "#6b7280";
const LOGO_STRONG = "#f3f4f6";
const LOGO_BLUE = "#3d63f2";

// The Wordmark logo's 30 × 24 drawing (src/components/Wordmark.tsx), scaled to sit beside the name.
const LOGO_WIDTH = 120;
const LOGO_HEIGHT = 96;

/** Static social preview shown when a Countersign link is shared: wordmark, the pitch line, the sample repository. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: BACKGROUND,
          color: FOREGROUND,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 96, fontWeight: 700, letterSpacing: "-0.045em" }}>
          <svg width={LOGO_WIDTH} height={LOGO_HEIGHT} viewBox="0 0 30 24" fill="none" style={{ marginRight: 28 }}>
            <rect x="1" y="3" width="13" height="3.2" rx="1.6" fill={LOGO_MUTED} />
            <rect x="1" y="10.4" width="17.5" height="3.2" rx="1.6" fill={LOGO_STRONG} />
            <rect x="1" y="17.8" width="10" height="3.2" rx="1.6" fill={LOGO_MUTED} />
            <path
              d="M21.5 1.6c2.6 0 3.2 1.1 3.2 3.2v3.8c0 1.6.9 2.7 2.9 3.4-2 .7-2.9 1.8-2.9 3.4v3.8c0 2.1-.6 3.2-3.2 3.2"
              stroke={LOGO_BLUE}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          countersign
        </div>
        <div style={{ display: "flex", fontSize: 40, marginTop: 32 }}>
          AI reviews. A named human countersigns, on evidence they can check.
        </div>
        <div style={{ display: "flex", fontSize: 24, marginTop: 56, color: MUTED }}>
          Built on Tieto&apos;s four agent-written changes to MessagePack-CSharp · Junction 2026
        </div>
      </div>
    ),
    size,
  );
}
