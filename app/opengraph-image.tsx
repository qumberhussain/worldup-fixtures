import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

export const alt = SITE.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Dynamically-generated social share card (Open Graph / Twitter). Rendered at
// build/request time by next/og — no static asset to maintain.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background:
            "linear-gradient(135deg, #13203f 0%, #0b1220 55%, #0a0f1f 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{ fontSize: 64 }}>⚽</div>
          <div
            style={{
              fontSize: 30,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#93a0bd",
            }}
          >
            FIFA World Cup 2026
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05 }}>
            Live Scores, Fixtures &amp; Results
          </div>
          <div style={{ fontSize: 38, color: "#cdd6ea", lineHeight: 1.3 }}>
            Goal scorers, cards &amp; the UK TV channel for every match
          </div>
        </div>

        <div style={{ display: "flex", gap: "16px" }}>
          {["LIVE", "BBC / ITV", "Your timezone"].map((chip) => (
            <div
              key={chip}
              style={{
                display: "flex",
                fontSize: 26,
                fontWeight: 600,
                color: "#5b8cff",
                background: "rgba(91,140,255,0.14)",
                border: "1px solid rgba(91,140,255,0.4)",
                borderRadius: 999,
                padding: "10px 26px",
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
