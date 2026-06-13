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

export interface MatchDetail {
  id: number;
  source: "football-data.org" | "sample";
  goals: Goal[];
}

export interface FixturesPayload {
  competition: string;
  season: string;
  source: "football-data.org" | "sample";
  lastUpdated: string;
  count: number;
  matches: Match[];
}

export type MatchKind = "live" | "played" | "upcoming";
