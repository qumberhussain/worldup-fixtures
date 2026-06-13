import type { Goal, Match } from "./types";

/**
 * Fallback fixtures used when FOOTBALL_DATA_API_KEY is not configured, so the
 * deployed page always renders. Clearly flagged as sample data in the UI.
 * `channel` is left null here and merged from lib/channels.ts in the API route.
 */
export const SAMPLE_MATCHES: Match[] = [
  {
    id: 1, utcDate: "2026-06-11T19:00:00Z", status: "FINISHED", matchday: 1,
    stage: "GROUP_STAGE", group: "Group A", venue: "Estadio Azteca, Mexico City",
    homeTeam: { name: "Mexico", tla: "MEX", crest: "" },
    awayTeam: { name: "Croatia", tla: "CRO", crest: "" },
    score: { home: 2, away: 1 }, channel: null,
  },
  {
    id: 2, utcDate: "2026-06-12T19:00:00Z", status: "FINISHED", matchday: 1,
    stage: "GROUP_STAGE", group: "Group B", venue: "SoFi Stadium, Los Angeles",
    homeTeam: { name: "Canada", tla: "CAN", crest: "" },
    awayTeam: { name: "Japan", tla: "JPN", crest: "" },
    score: { home: 1, away: 1 }, channel: null,
  },
  {
    id: 3, utcDate: "2026-06-13T16:00:00Z", status: "IN_PLAY", matchday: 1,
    stage: "GROUP_STAGE", group: "Group C", venue: "MetLife Stadium, New York",
    homeTeam: { name: "United States", tla: "USA", crest: "" },
    awayTeam: { name: "Ghana", tla: "GHA", crest: "" },
    score: { home: 1, away: 0 }, channel: null,
  },
  {
    id: 4, utcDate: "2026-06-14T19:00:00Z", status: "TIMED", matchday: 1,
    stage: "GROUP_STAGE", group: "Group D", venue: "AT&T Stadium, Dallas",
    homeTeam: { name: "England", tla: "ENG", crest: "" },
    awayTeam: { name: "Senegal", tla: "SEN", crest: "" },
    score: { home: null, away: null }, channel: null,
  },
  {
    id: 5, utcDate: "2026-06-15T22:00:00Z", status: "TIMED", matchday: 1,
    stage: "GROUP_STAGE", group: "Group E", venue: "Lincoln Financial Field, Philadelphia",
    homeTeam: { name: "Brazil", tla: "BRA", crest: "" },
    awayTeam: { name: "Morocco", tla: "MAR", crest: "" },
    score: { home: null, away: null }, channel: null,
  },
  {
    id: 6, utcDate: "2026-06-16T19:00:00Z", status: "SCHEDULED", matchday: 1,
    stage: "GROUP_STAGE", group: "Group F", venue: "Mercedes-Benz Stadium, Atlanta",
    homeTeam: { name: "Argentina", tla: "ARG", crest: "" },
    awayTeam: { name: "Australia", tla: "AUS", crest: "" },
    score: { home: null, away: null }, channel: null,
  },
];

/** Sample goal timelines keyed by match id, used when no API key is set. */
export const SAMPLE_GOALS: Record<number, Goal[]> = {
  1: [
    { minute: 23, injuryTime: null, side: "home", scorer: "R. Jiménez", assist: "H. Lozano", type: "REGULAR" },
    { minute: 41, injuryTime: null, side: "away", scorer: "A. Kramarić", assist: null, type: "REGULAR" },
    { minute: 67, injuryTime: null, side: "home", scorer: "H. Lozano", assist: "E. Álvarez", type: "REGULAR" },
  ],
  2: [
    { minute: 38, injuryTime: null, side: "home", scorer: "J. David", assist: null, type: "PENALTY" },
    { minute: 72, injuryTime: null, side: "away", scorer: "K. Mitoma", assist: "W. Endō", type: "REGULAR" },
  ],
  3: [
    { minute: 35, injuryTime: null, side: "home", scorer: "C. Pulisic", assist: "W. McKennie", type: "REGULAR" },
  ],
};
