import type { Match, MatchKind, Team } from "./types";

const LIVE_STATUSES = new Set(["IN_PLAY", "PAUSED", "SUSPENDED"]);
const FINISHED_STATUSES = new Set(["FINISHED", "AWARDED"]);

export function hasScore(m: Match): boolean {
  return m.score?.home != null && m.score?.away != null;
}

/** Decide whether a match is live, already played, or still upcoming. */
export function classify(m: Match): MatchKind {
  const kicked = new Date(m.utcDate).getTime();
  const minsSince = Number.isFinite(kicked) ? (Date.now() - kicked) / 60000 : 0;

  if (LIVE_STATUSES.has(m.status)) {
    // The free-tier feed lags the FINISHED status, leaving matches stuck on
    // "in play" long after full time. No realistic match runs this long after
    // kick-off, so treat a stale "live" status as finished/upcoming instead.
    const maxLiveMins = m.stage && m.stage !== "GROUP_STAGE" ? 200 : 140;
    if (Number.isFinite(kicked) && minsSince > maxLiveMins) {
      return hasScore(m) ? "played" : "upcoming";
    }
    return "live";
  }
  if (FINISHED_STATUSES.has(m.status)) return "played";
  if (Number.isFinite(kicked) && kicked < Date.now() && hasScore(m)) return "played";
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
