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
// Minimum seconds between real upstream calls, shared across ALL visitors.
// football-data.org free tier allows 10 calls/min; 12s => <=5/min for this
// endpoint, leaving headroom for the match-detail endpoint.
const UPSTREAM_TTL = 12;

// Module-scoped throttle cache. On a warm serverless instance this guarantees
// we never hit the API more than once per UPSTREAM_TTL regardless of how many
// browsers are polling, and lets us serve last-good data if the API errors.
let cache: { at: number; payload: FixturesPayload } | null = null;

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

  // Serve from the throttle cache if it's still fresh (rate-limit guard).
  if (cache && Date.now() - cache.at < UPSTREAM_TTL * 1000) {
    return json(cache.payload, { cached: true });
  }

  try {
    const res = await fetch(`${BASE}/competitions/${COMPETITION}/matches`, {
      headers: { "X-Auth-Token": apiKey },
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

    const payload: FixturesPayload = {
      competition: data.competition?.name || "FIFA World Cup",
      season: String(data.filters?.season || ""),
      source: "football-data.org",
      lastUpdated: new Date().toISOString(),
      count: matches.length,
      matches,
    };
    cache = { at: Date.now(), payload };
    return json(payload);
  } catch (err) {
    // Prefer last-good data over breaking the page; fall back to sample.
    const extra = { error: err instanceof Error ? err.message : "unknown error" };
    if (cache) return json(cache.payload, { ...extra, stale: true });
    return json(sampleFixtures(), extra);
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
