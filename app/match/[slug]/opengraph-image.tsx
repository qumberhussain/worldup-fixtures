import { ImageResponse } from "next/og";
import { getMatchById } from "@/lib/fixtures";
import { parseMatchId } from "@/lib/slug";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "World Cup 2026 match";

// Per-match social share card.
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const id = parseMatchId(slug);
  const m = id != null ? await getMatchById(id) : undefined;

  const home = m?.homeTeam?.name || "TBD";
  const away = m?.awayTeam?.name || "TBD";
  const played = m && m.score?.home != null && m.score?.away != null;
  const center = played
    ? `${m!.score.home} – ${m!.score.away}`
    : m
      ? new Intl.DateTimeFormat("en-GB", {
          weekday: "short", day: "numeric", month: "short",
          hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
        }).format(new Date(m.utcDate))
      : "";
  const strap = [m?.group, m?.channel ? `📺 ${m.channel}` : null]
    .filter(Boolean)
    .join("  ·  ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "space-between", padding: "72px", color: "#fff",
          background: "linear-gradient(135deg, #13203f 0%, #0b1220 55%, #0a0f1f 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px", fontSize: 28, letterSpacing: 4, textTransform: "uppercase", color: "#93a0bd" }}>
          <span style={{ fontSize: 48 }}>⚽</span> FIFA World Cup 2026
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "40px", width: "100%" }}>
            <div style={{ fontSize: 64, fontWeight: 800, flex: 1, textAlign: "right" }}>{home}</div>
            <div style={{ fontSize: played ? 92 : 44, fontWeight: 800, color: "#3ddc97", whiteSpace: "nowrap" }}>{center}</div>
            <div style={{ fontSize: 64, fontWeight: 800, flex: 1, textAlign: "left" }}>{away}</div>
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 30, color: "#cdd6ea" }}>{strap}</div>
      </div>
    ),
    { ...size }
  );
}
