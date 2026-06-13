import { NextResponse } from "next/server";
import { normalizeMatch } from "@/lib/normalize";
import { getChannel } from "@/lib/channels";
import { SAMPLE_MATCHES } from "@/lib/sample";
import type { FixturesPayload, Match } from "@/lib/types";

// Always run on each request; we cache the *upstream* call ourselves below so
// the browser can poll frequently without burning the free-tier rate limit.
export const dynamic = "force-dynamic";

const COMPETITION = process.env.COMPETITION || "WC";
const BASE = "https://api.football-data.org/v4";
// Seconds the upstream response is reused across all visitors.
const UPSTREAM_TTL = 15;

/** Merge the curated UK channel onto each match. */
function withChannels(matches: Match[]): Match[] {
  return matches.map((m) => ({ ...m, channel: getChannel(m) }));
}

function sampleFixtures(): FixturesPayload {
  return {
    competition: "FIFA World Cup 2026",
    season: "2026",
    source: "sample",
    lastUpdated: new Date().toISOString(),
    count: SAMPLE_MATCHES.length,
    matches: withChannels(SAMPLE_MATCHES),
  };
}

export async function GET() {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  // No key configured -> serve sample data so the page still works.
  if (!apiKey) {
    return json(sampleFixtures());
  }

  try {
    const res = await fetch(`${BASE}/competitions/${COMPETITION}/matches`, {
      headers: { "X-Auth-Token": apiKey },
      // Next.js data cache: one upstream hit per TTL window, shared by all clients.
      next: { revalidate: UPSTREAM_TTL },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`football-data.org ${res.status}: ${body.slice(0, 160)}`);
    }

    const data = await res.json();
    const raw = Array.isArray(data.matches) ? data.matches : [];
    const matches = withChannels(
      raw
        .map(normalizeMatch)
        .sort((a: Match, b: Match) =>
          new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
        )
    );

    return json({
      competition: data.competition?.name || "FIFA World Cup",
      season: String(data.filters?.season || ""),
      source: "football-data.org",
      lastUpdated: new Date().toISOString(),
      count: matches.length,
      matches,
    });
  } catch (err) {
    // On upstream failure, fall back to sample data rather than breaking the page.
    return json(sampleFixtures(), {
      error: err instanceof Error ? err.message : "unknown error",
    });
  }
}

function json(payload: FixturesPayload, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { ...payload, ...extra },
    {
      headers: {
        // Let the browser/CDN reuse for a few seconds; SWR keeps it feeling live.
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
      },
    }
  );
}
