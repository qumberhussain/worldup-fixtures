import type { Match, MatchKind, Team } from "./types";

const LIVE_STATUSES = new Set(["IN_PLAY", "PAUSED", "SUSPENDED"]);
const FINISHED_STATUSES = new Set(["FINISHED", "AWARDED"]);
// Pre-match statuses the free feed leaves stale once a game actually kicks off.
const PRE_STATUSES = new Set(["TIMED", "SCHEDULED"]);
// A real match can't reach full-time sooner than ~2x45' + 15' half-time from
// kick-off, so ~100 min wall-clock is the floor for a legitimate FINISHED.
const MIN_FULLTIME_MINS = 100;

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

  // 1. Feed confirms finished — but distrust a FINISHED flag that lands
  //    implausibly early. Around kick-off the free feed can briefly mark a
  //    knockout slot as finished (a placeholder/stale result) before live data
  //    flows, which otherwise shows "Full time" 10' into a live match. A real
  //    match needs ~100 min from KO to legitimately reach full-time.
  if (FINISHED_STATUSES.has(m.status)) {
    if (valid && minsSince < MIN_FULLTIME_MINS) {
      // Not enough time to have finished: if it hasn't kicked off yet it's
      // upcoming, otherwise it's still in progress (don't assert the score).
      return minsSince <= 0 ? "upcoming" : "underway";
    }
    return "played";
  }

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
    fullTime?: Side;
    regularTime?: Side;
    extraTime?: Side;
    penalties?: Side;
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
  const s = m.score ?? {};
  const ft: Side = s.fullTime ?? {};
  const rt: Side = s.regularTime ?? {};
  const et: Side = s.extraTime ?? {};
  const pk: Side = s.penalties ?? {};
  const duration = s.duration ?? null;
  const wentLong = duration === "EXTRA_TIME" || duration === "PENALTY_SHOOTOUT";

  // Headline = the score the match finished on, after extra time but BEFORE any
  // shootout. For shootouts football-data's `fullTime` is unreliable (its
  // `penalties` node has been seen to duplicate the home value from the away
  // one, and that bad number is folded into fullTime), so for any match that
  // ran past 90' we rebuild the score from the trustworthy regularTime (+
  // extraTime) nodes instead. Plain matches keep fullTime as-is.
  const haveRegular = num(rt.home) != null && num(rt.away) != null;
  const home = wentLong && haveRegular
    ? (num(rt.home) ?? 0) + (num(et.home) ?? 0)
    : num(ft.home);
  const away = wentLong && haveRegular
    ? (num(rt.away) ?? 0) + (num(et.away) ?? 0)
    : num(ft.away);

  // Only keep the shootout score when it actually separates the teams — a
  // home==away value is the known-bad feed, not a real result.
  const penHome = num(pk.home), penAway = num(pk.away);
  const penaltiesDecisive = penHome != null && penAway != null && penHome !== penAway;

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
    score: { home, away },
    penalties: penaltiesDecisive ? { home: penHome, away: penAway } : null,
    winner: s.winner ?? null,
    duration,
    channel: null,
    minute: m.minute ?? null,
    injuryTime: m.injuryTime ?? null,
  };
}

/** Whether the tie was settled on penalties (regardless of whether we have a
 *  trustworthy shootout score to show). */
export function decidedOnPenalties(m: Match): boolean {
  return m.duration === "PENALTY_SHOOTOUT";
}

/** True when the match ran past 90' (extra time, with or without a shootout). */
export function wentToExtraTime(m: Match): boolean {
  return m.duration === "EXTRA_TIME" || m.duration === "PENALTY_SHOOTOUT";
}

/**
 * The winning side. Trusts football-data's `winner` field (which survives the
 * buggy penalties node); falls back to comparing the headline score.
 */
export function winnerSide(m: Match): "home" | "away" | null {
  if (m.winner === "HOME_TEAM") return "home";
  if (m.winner === "AWAY_TEAM") return "away";
  if (m.winner === "DRAW") return null;
  if (!hasScore(m)) return null;
  if (m.score.home! > m.score.away!) return "home";
  if (m.score.away! > m.score.home!) return "away";
  return null;
}
