import { ImageResponse } from "next/og";

export const alt = "Countersign: AI reviews. A named human countersigns, on evidence they can check.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// These hex values mirror src/styles/tokens.css (--surface-bg, --text-primary,
// --text-muted) and the brace in src/app/icon.svg: ImageResponse can't read CSS variables.
const BACKGROUND = "#0d0f12";
const FOREGROUND = "#e6e8eb";
const MUTED = "#9aa3af";
const ACCENT = "#3d63f2";

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
        <div style={{ display: "flex", fontSize: 96, fontWeight: 700 }}>
          <span style={{ color: ACCENT, marginRight: 24 }}>{"{"}</span>
          Countersign
        </div>
        <div style={{ display: "flex", fontSize: 40, marginTop: 32 }}>
          AI reviews. A named human countersigns, on evidence they can check.
        </div>
        <div style={{ display: "flex", fontSize: 28, marginTop: 56, color: MUTED }}>
          Built on Tieto&apos;s MessagePack-CSharp changes · Junction 2026
        </div>
      </div>
    ),
    size,
  );
}
