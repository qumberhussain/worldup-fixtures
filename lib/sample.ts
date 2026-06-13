import type { Goal, Match } from "./types";

/**
 * Fallback fixtures used when FOOTBALL_DATA_API_KEY is not configured, so the
 * deployed page always renders. Uses real WC 2026 fixtures so the demo matches
 * the live layout; `channel` is merged from lib/channels.ts in the API route.
 */
export const SAMPLE_MATCHES: Match[] = [
  {
    id: 1, utcDate: "2026-06-11T19:00:00Z", status: "FINISHED", matchday: 1,
    stage: "GROUP_STAGE", group: "Group A", venue: "Estadio Azteca, Mexico City",
    homeTeam: { name: "Mexico", tla: "MEX", crest: "" },
    awayTeam: { name: "South Africa", tla: "RSA", crest: "" },
    score: { home: 2, away: 0 }, channel: null,
  },
  {
    id: 2, utcDate: "2026-06-12T16:00:00Z", status: "FINISHED", matchday: 1,
    stage: "GROUP_STAGE", group: "Group A", venue: "Estadio Akron, Guadalajara",
    homeTeam: { name: "South Korea", tla: "KOR", crest: "" },
    awayTeam: { name: "Czech Republic", tla: "CZE", crest: "" },
    score: { home: 2, away: 1 }, channel: null,
  },
  {
    id: 3, utcDate: "2026-06-13T15:00:00Z", status: "IN_PLAY", matchday: 1,
    stage: "GROUP_STAGE", group: "Group C", venue: "MetLife Stadium, New York",
    homeTeam: { name: "Brazil", tla: "BRA", crest: "" },
    awayTeam: { name: "Morocco", tla: "MAR", crest: "" },
    score: { home: 1, away: 0 }, channel: null,
  },
  {
    id: 4, utcDate: "2026-06-14T01:00:00Z", status: "TIMED", matchday: 1,
    stage: "GROUP_STAGE", group: "Group C", venue: "Gillette Stadium, Boston",
    homeTeam: { name: "Haiti", tla: "HAI", crest: "" },
    awayTeam: { name: "Scotland", tla: "SCO", crest: "" },
    score: { home: null, away: null }, channel: null,
  },
  {
    id: 5, utcDate: "2026-06-16T19:00:00Z", status: "TIMED", matchday: 1,
    stage: "GROUP_STAGE", group: "Group L", venue: "Lincoln Financial Field, Philadelphia",
    homeTeam: { name: "England", tla: "ENG", crest: "" },
    awayTeam: { name: "Croatia", tla: "CRO", crest: "" },
    score: { home: null, away: null }, channel: null,
  },
  {
    id: 6, utcDate: "2026-06-16T22:00:00Z", status: "SCHEDULED", matchday: 1,
    stage: "GROUP_STAGE", group: "Group J", venue: "Mercedes-Benz Stadium, Atlanta",
    homeTeam: { name: "Argentina", tla: "ARG", crest: "" },
    awayTeam: { name: "Algeria", tla: "ALG", crest: "" },
    score: { home: null, away: null }, channel: null,
  },
];

/** Sample goal timelines keyed by match id, used when no API key is set. */
export const SAMPLE_GOALS: Record<number, Goal[]> = {
  1: [
    { minute: 23, injuryTime: null, side: "home", scorer: "R. Jiménez", assist: "H. Lozano", type: "REGULAR" },
    { minute: 67, injuryTime: null, side: "home", scorer: "H. Lozano", assist: "E. Álvarez", type: "REGULAR" },
  ],
  2: [
    { minute: 30, injuryTime: null, side: "home", scorer: "Son Heung-min", assist: null, type: "REGULAR" },
    { minute: 74, injuryTime: null, side: "home", scorer: "Lee Kang-in", assist: "Son Heung-min", type: "REGULAR" },
    { minute: 85, injuryTime: null, side: "away", scorer: "P. Schick", assist: null, type: "PENALTY" },
  ],
  3: [
    { minute: 40, injuryTime: null, side: "home", scorer: "Vinícius Jr.", assist: "Rodrygo", type: "REGULAR" },
  ],
};
