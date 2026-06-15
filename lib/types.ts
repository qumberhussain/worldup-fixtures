export type MatchStatus =
  | "SCHEDULED"
  | "TIMED"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "AWARDED"
  | "SUSPENDED"
  | "POSTPONED"
  | "CANCELLED"
  | string;

export interface Team {
  name: string;
  tla: string | null;
  crest: string;
}

export interface Match {
  id: number;
  utcDate: string;
  status: MatchStatus;
  matchday: number | null;
  stage: string | null;
  group: string | null;
  venue: string | null;
  homeTeam: Team;
  awayTeam: Team;
  score: { home: number | null; away: number | null };
  /** UK broadcast channel, merged from the curated channel map. */
  channel: string | null;
  /** Live elapsed minute while IN_PLAY — only present on paid tiers; null otherwise. */
  minute?: number | null;
  /** Live stoppage-time minutes (paid tiers), if any. */
  injuryTime?: number | null;
}

export interface Goal {
  minute: number | null;
  /** Extra/injury-time minutes, if any (e.g. 90+3). */
  injuryTime: number | null;
  side: "home" | "away";
  scorer: string;
  assist: string | null;
  /** REGULAR | OWN | PENALTY */
  type: string | null;
}

export interface Card {
  minute: number | null;
  injuryTime: number | null;
  side: "home" | "away";
  player: string;
  /** YELLOW | RED */
  type: "YELLOW" | "RED";
}

export interface MatchDetail {
  id: number;
  source: "football-data.org" | "sample" | "curated";
  goals: Goal[];
  cards: Card[];
}

export interface FixturesPayload {
  competition: string;
  season: string;
  source: "football-data.org" | "sample";
  lastUpdated: string;
  count: number;
  matches: Match[];
}

/**
 * - live:     feed confirms IN_PLAY — we trust the score.
 * - underway: kick-off has passed but the (free-tier) feed hasn't flipped to
 *             IN_PLAY yet, so the match is in progress but the score may be
 *             stale/unavailable. We don't assert a score we can't trust.
 * - played:   finished.
 * - upcoming: not started.
 */
export type MatchKind = "live" | "underway" | "played" | "upcoming";
