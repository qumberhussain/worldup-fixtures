import { teamCode } from "./channels";
import scrapedData from "@/data/events.json";
import type { Card, Goal, Match } from "./types";

/**
 * Curated match events (goals + cards) for completed matches — there is no
 * free API for goal scorers and bookings, so these are maintained by hand from
 * published match reports (BBC Sport / Wikipedia). Keyed by an unordered FIFA
 * team-code pair; each event carries the scoring/booked team's code so the
 * route can assign it to the correct home/away side regardless of key order.
 *
 * Add a new entry per match as it finishes. Minutes use `injuryTime` for
 * stoppage-time events (e.g. 90+5 -> minute 90, injuryTime 5).
 */
export interface CuratedGoal {
  minute: number;
  injuryTime?: number;
  team: string; // FIFA code of the team the goal counts for
  scorer: string;
  type?: "REGULAR" | "PENALTY" | "OWN";
  assist?: string;
}
export interface CuratedCard {
  minute: number;
  injuryTime?: number;
  team: string; // FIFA code of the booked player's team
  player: string;
  type: "YELLOW" | "RED";
}
export interface CuratedMatch {
  goals: CuratedGoal[];
  cards: CuratedCard[];
}

export const MATCH_EVENTS: Record<string, CuratedMatch> = {
  // Mexico 2-0 South Africa (11 Jun)
  "MEX|RSA": {
    goals: [
      { minute: 9, team: "MEX", scorer: "Julián Quiñones" },
      { minute: 67, team: "MEX", scorer: "Raúl Jiménez" },
    ],
    cards: [
      { minute: 17, team: "RSA", player: "Teboho Mokoena", type: "YELLOW" },
      { minute: 23, team: "MEX", player: "Brian Gutiérrez", type: "YELLOW" },
      { minute: 49, team: "RSA", player: "Sphephelo Sithole", type: "RED" },
      { minute: 74, team: "RSA", player: "Nkosinathi Sibisi", type: "YELLOW" },
      { minute: 84, team: "RSA", player: "Themba Zwane", type: "RED" },
      { minute: 90, injuryTime: 2, team: "MEX", player: "César Montes", type: "RED" },
    ],
  },
  // South Korea 2-1 Czech Republic (12 Jun)
  "KOR|CZE": {
    goals: [
      { minute: 59, team: "CZE", scorer: "Ladislav Krejčí" },
      { minute: 67, team: "KOR", scorer: "Hwang In-beom" },
      { minute: 80, team: "KOR", scorer: "Oh Hyeon-gyu" },
    ],
    cards: [
      { minute: 90, injuryTime: 6, team: "KOR", player: "Lee Gi-hyuk", type: "YELLOW" },
    ],
  },
  // Canada 1-1 Bosnia and Herzegovina (12 Jun)
  "CAN|BIH": {
    goals: [
      { minute: 21, team: "BIH", scorer: "Jovo Lukić" },
      { minute: 78, team: "CAN", scorer: "Cyle Larin" },
    ],
    cards: [
      { minute: 11, team: "CAN", player: "Alistair Johnston", type: "YELLOW" },
      { minute: 44, team: "BIH", player: "Ermedin Demirović", type: "YELLOW" },
      { minute: 45, injuryTime: 1, team: "BIH", player: "Jovo Lukić", type: "YELLOW" },
      { minute: 53, team: "CAN", player: "Luc de Fougerolles", type: "YELLOW" },
      { minute: 90, injuryTime: 3, team: "BIH", player: "Nikola Katić", type: "YELLOW" },
    ],
  },
  // United States 4-1 Paraguay (12 Jun)
  "USA|PAR": {
    goals: [
      { minute: 7, team: "USA", scorer: "Damián Bobadilla", type: "OWN" },
      { minute: 31, team: "USA", scorer: "Folarin Balogun" },
      { minute: 45, injuryTime: 5, team: "USA", scorer: "Folarin Balogun" },
      { minute: 73, team: "PAR", scorer: "Maurício" },
      { minute: 90, injuryTime: 8, team: "USA", scorer: "Giovanni Reyna" },
    ],
    cards: [
      { minute: 9, team: "PAR", player: "Juan José Cáceres", type: "YELLOW" },
      { minute: 53, team: "PAR", player: "Miguel Almirón", type: "YELLOW" },
      { minute: 59, team: "USA", player: "Tyler Adams", type: "YELLOW" },
      { minute: 79, team: "PAR", player: "Diego Gómez", type: "YELLOW" },
      { minute: 88, team: "PAR", player: "Álex Arce", type: "YELLOW" },
      { minute: 90, injuryTime: 3, team: "PAR", player: "Júnior Alonso", type: "YELLOW" },
    ],
  },
};

// Goals auto-scraped from Wikipedia (data/events.json), refreshed by the cron.
// Goals only — cards can't be reliably attributed from that source.
interface ScrapedFile {
  matches: Record<string, { goals: CuratedGoal[] }>;
}
const SCRAPED = (scrapedData as unknown as ScrapedFile).matches || {};

/**
 * Resolve events for a pair. Hand-curated entries (goals + verified cards) win;
 * otherwise fall back to the auto-scraped goals (no cards).
 */
function lookup(homeCode: string, awayCode: string): CuratedMatch | null {
  const keys = [`${homeCode}|${awayCode}`, `${awayCode}|${homeCode}`];
  for (const k of keys) if (MATCH_EVENTS[k]) return MATCH_EVENTS[k];
  for (const k of keys) if (SCRAPED[k]) return { goals: SCRAPED[k].goals, cards: [] };
  return null;
}

/** Resolve curated goals + cards for a match, mapped to home/away sides. */
export function getMatchEvents(
  home: Match["homeTeam"],
  away: Match["awayTeam"]
): { goals: Goal[]; cards: Card[] } | null {
  const h = teamCode(home);
  const a = teamCode(away);
  if (!h || !a) return null;
  const entry = lookup(h, a);
  if (!entry) return null;

  const side = (teamTla: string): "home" | "away" => (teamTla === h ? "home" : "away");

  const goals: Goal[] = entry.goals.map((g) => ({
    minute: g.minute,
    injuryTime: g.injuryTime ?? null,
    side: side(g.team),
    scorer: g.scorer,
    assist: g.assist ?? null,
    type: g.type ?? "REGULAR",
  }));
  const cards: Card[] = entry.cards.map((c) => ({
    minute: c.minute,
    injuryTime: c.injuryTime ?? null,
    side: side(c.team),
    player: c.player,
    type: c.type,
  }));
  return { goals, cards };
}
