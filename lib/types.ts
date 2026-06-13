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
