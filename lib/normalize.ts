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
  minute?: number | null;
  injuryTime?: number | null;
  homeTeam?: RawTeam;
  awayTeam?: RawTeam;
  score?: {
    winner?: string | null;
    duration?: string | null;
    // `fullTime` is cumulative: for a shootout it equals regular + extra +
    // penalties. We derive the headline (pre-shootout) score by subtracting the
    // `penalties` node back out, so we never depend on regularTime/extraTime
    // being present.
    fullTime?: { home?: number | null; away?: number | null };
    penalties?: { home?: number | null; away?: number | null };
  };
}

type Side = { home?: number | null; away?: number | null };

const num = (v?: number | null): number | null => (typeof v === "number" ? v : null);

function normalizeTeam(t?: RawTeam): Team {
  if (!t) return { name: "TBD", tla: null, crest: "" };
  return {
    name: t.name || t.shortName || "TBD",
    tla: t.tla || null,
    crest: t.crest || "",
  };
}

export function normalizeMatch(m: RawMatch): Match {
  const ft: Side = m.score?.fullTime ?? {};
  const pk: Side = m.score?.penalties ?? {};
  const penHome = num(pk.home);
  const penAway = num(pk.away);
  const hasPenalties = penHome != null && penAway != null;

  // football-data.org folds the shootout into `fullTime`, so peel it back off to
  // recover the result the match actually finished on (e.g. 1–1, won on pens).
  const stripPens = (full: number | null, pen: number | null): number | null =>
    full != null && pen != null ? full - pen : full;

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
      home: stripPens(num(ft.home), penHome),
      away: stripPens(num(ft.away), penAway),
    },
    penalties: hasPenalties ? { home: penHome, away: penAway } : null,
    duration: m.score?.duration ?? null,
    channel: null,
    minute: m.minute ?? null,
    injuryTime: m.injuryTime ?? null,
  };
}

/** Whether the tie was settled on penalties (and we have the shootout score). */
export function decidedOnPenalties(m: Match): boolean {
  return (
    m.duration === "PENALTY_SHOOTOUT" &&
    m.penalties?.home != null &&
    m.penalties?.away != null
  );
}

/** True when the match ran past 90' (extra time, with or without a shootout). */
export function wentToExtraTime(m: Match): boolean {
  return m.duration === "EXTRA_TIME" || m.duration === "PENALTY_SHOOTOUT";
}

/**
 * The winning side, accounting for a shootout: a penalty win counts even though
 * the headline score is level. Returns null for an honest draw or no result.
 */
export function winnerSide(m: Match): "home" | "away" | null {
  if (decidedOnPenalties(m)) {
    const h = m.penalties!.home!, a = m.penalties!.away!;
    return h > a ? "home" : a > h ? "away" : null;
  }
  if (!hasScore(m)) return null;
  if (m.score.home! > m.score.away!) return "home";
  if (m.score.away! > m.score.home!) return "away";
  return null;
}
