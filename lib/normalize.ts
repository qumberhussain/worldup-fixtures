import type { Match, MatchKind, Team } from "./types";

const LIVE_STATUSES = new Set(["IN_PLAY", "PAUSED", "SUSPENDED"]);
const FINISHED_STATUSES = new Set(["FINISHED", "AWARDED"]);
// Pre-match statuses the free feed leaves stale once a game actually kicks off.
const PRE_STATUSES = new Set(["TIMED", "SCHEDULED"]);

export function hasScore(m: Match): boolean {
  return m.score?.home != null && m.score?.away != null;
}

/** Decide whether a match is live, underway, already played, or still upcoming. */
export function classify(m: Match): MatchKind {
  const kicked = new Date(m.utcDate).getTime();
  const valid = Number.isFinite(kicked);
  const minsSince = valid ? (Date.now() - kicked) / 60000 : 0;
  // Group games finish ~115 min after KO (max ~125 with long stoppage); 130
  // gives a small safety margin. Knockouts allow for extra time + penalties.
  const maxLiveMins = m.stage && m.stage !== "GROUP_STAGE" ? 190 : 130;

  // 1. Feed confirms finished.
  if (FINISHED_STATUSES.has(m.status)) return "played";

  // 2. Feed confirms live — but distrust a status stuck "in play" well past a
  //    realistic match length (the free feed lags the FINISHED flag).
  if (LIVE_STATUSES.has(m.status)) {
    if (valid && minsSince > maxLiveMins) return hasScore(m) ? "played" : "upcoming";
    return "live";
  }

  // 3. Feed still says "scheduled" but the clock says otherwise. The free tier
  //    lags IN_PLAY/score updates, so once kick-off has passed and we're inside
  //    a realistic match window, infer the match is underway rather than
  //    trusting the stale status (and without asserting a score we don't have).
  if (valid && PRE_STATUSES.has(m.status) && minsSince > 0) {
    if (minsSince <= maxLiveMins) return "underway";
    return hasScore(m) ? "played" : "upcoming";
  }

  // 4. Any other status (postponed/cancelled/unknown) or not yet kicked off.
  if (valid && minsSince > 0 && hasScore(m)) return "played";
  return "upcoming";
}

/* ---- football-data.org -> our shape ---- */

interface RawTeam {
  name?: string;
  shortName?: string;
  tla?: string;
  crest?: string;
}

interface RawMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday?: number | null;
  stage?: string | null;
  group?: string | null;
  venue?: string | null;
  homeTeam?: RawTeam;
  awayTeam?: RawTeam;
  score?: { fullTime?: { home?: number | null; away?: number | null } };
}

function normalizeTeam(t?: RawTeam): Team {
  if (!t) return { name: "TBD", tla: null, crest: "" };
  return {
    name: t.name || t.shortName || "TBD",
    tla: t.tla || null,
    crest: t.crest || "",
  };
}

export function normalizeMatch(m: RawMatch): Match {
  return {
    id: m.id,
    utcDate: m.utcDate,
    status: m.status,
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
    channel: null,
  };
}
