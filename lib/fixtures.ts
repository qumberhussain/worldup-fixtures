import { normalizeMatch } from "./normalize";
import { getChannel } from "./channels";
import { SAMPLE_MATCHES } from "./sample";
import type { FixturesPayload, Match } from "./types";

/**
 * Shared fixtures loader used by BOTH the polling API route (`/api/fixtures`)
 * and the server-rendered homepage. Centralising it here means the module-scoped
 * throttle cache is shared: a server render and the browser poll can't each fire
 * their own upstream call, so we still respect the free-tier 10-calls/min limit.
 */

const COMPETITION = process.env.COMPETITION || "WC";
const BASE = "https://api.football-data.org/v4";
// Minimum seconds between real upstream calls, shared across ALL callers.
// football-data.org free tier allows 10 calls/min; 12s => <=5/min, leaving
// headroom for the match-detail endpoint.
const UPSTREAM_TTL = 12;

// Module-scoped throttle cache. On a warm serverless instance this guarantees
// we never hit the API more than once per UPSTREAM_TTL regardless of how many
// browsers poll, and lets us serve last-good data if the API errors.
let cache: { at: number; payload: FixturesPayload } | null = null;

/** Extra status surfaced alongside the payload (mirrors the old route shape). */
export interface FixturesMeta {
  cached?: boolean;
  stale?: boolean;
  error?: string;
}

/** Merge the curated UK channel onto each match. */
function withChannels(matches: Match[]): Match[] {
  return matches.map((m) => ({ ...m, channel: getChannel(m) }));
}

export function sampleFixtures(): FixturesPayload {
  return {
    competition: "FIFA World Cup 2026",
    season: "2026",
    source: "sample",
    lastUpdated: new Date().toISOString(),
    count: SAMPLE_MATCHES.length,
    matches: withChannels(SAMPLE_MATCHES),
  };
}

/**
 * Load fixtures, respecting the shared throttle cache and falling back to
 * sample data so the page never breaks. Returns the payload plus meta flags.
 */
export async function loadFixtures(): Promise<{
  payload: FixturesPayload;
  meta: FixturesMeta;
}> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  // No key configured -> serve sample data so the page still works.
  if (!apiKey) return { payload: sampleFixtures(), meta: {} };

  // Serve from the throttle cache if it's still fresh (rate-limit guard).
  if (cache && Date.now() - cache.at < UPSTREAM_TTL * 1000) {
    return { payload: cache.payload, meta: { cached: true } };
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
    return { payload, meta: {} };
  } catch (err) {
    // Prefer last-good data over breaking the page; fall back to sample.
    const error = err instanceof Error ? err.message : "unknown error";
    if (cache) return { payload: cache.payload, meta: { stale: true, error } };
    return { payload: sampleFixtures(), meta: { error } };
  }
}
