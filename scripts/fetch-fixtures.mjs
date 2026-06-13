#!/usr/bin/env node
/**
 * Fetches FIFA World Cup matches from football-data.org and writes a
 * normalized data/fixtures.json that the static site consumes.
 *
 * Requires env FOOTBALL_DATA_API_KEY (free key from football-data.org).
 * Optional env COMPETITION (defaults to "WC").
 *
 * Run: FOOTBALL_DATA_API_KEY=xxx node scripts/fetch-fixtures.mjs
 */

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "data", "fixtures.json");

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const COMPETITION = process.env.COMPETITION || "WC";
const BASE = "https://api.football-data.org/v4";

if (!API_KEY) {
  console.error("✖ FOOTBALL_DATA_API_KEY is not set. Aborting.");
  process.exit(1);
}

async function main() {
  const url = `${BASE}/competitions/${COMPETITION}/matches`;
  console.log(`→ Fetching ${url}`);

  const res = await fetch(url, { headers: { "X-Auth-Token": API_KEY } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`football-data.org responded ${res.status} ${res.statusText} — ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const rawMatches = Array.isArray(json.matches) ? json.matches : [];

  const matches = rawMatches.map(normalizeMatch).sort(
    (a, b) => new Date(a.utcDate) - new Date(b.utcDate)
  );

  const out = {
    competition: json.competition?.name || "FIFA World Cup",
    season: String(json.filters?.season || json.competition?.season?.startDate?.slice(0, 4) || ""),
    source: "football-data.org",
    lastUpdated: new Date().toISOString(),
    count: matches.length,
    matches,
  };

  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`✔ Wrote ${matches.length} matches to data/fixtures.json`);
}

function normalizeMatch(m) {
  return {
    id: m.id,
    utcDate: m.utcDate,
    status: m.status, // SCHEDULED | TIMED | IN_PLAY | PAUSED | FINISHED | ...
    matchday: m.matchday ?? null,
    stage: m.stage ?? null,
    group: m.group ?? null,
    venue: m.venue ?? null,
    homeTeam: normalizeTeam(m.homeTeam),
    awayTeam: normalizeTeam(m.awayTeam),
    score: {
      home: m.score?.fullTime?.home ?? null,
      away: m.score?.fullTime?.away ?? null,
    },
  };
}

function normalizeTeam(t) {
  if (!t) return { name: "TBD", tla: null, crest: "" };
  return {
    name: t.name || t.shortName || "TBD",
    tla: t.tla || null,
    crest: t.crest || "",
  };
}

main().catch((err) => {
  console.error("✖", err.message);
  process.exit(1);
});
