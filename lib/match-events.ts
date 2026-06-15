import { getMatchEvents } from "./events";
import { SAMPLE_GOALS } from "./sample";
import type { Card, Goal, Match, MatchDetail } from "./types";

/**
 * Shared match-events loader used by the `/api/match/[id]` route AND the
 * server-rendered match page. Precedence:
 *   1. hand-curated / Wikipedia-scraped events (free, no API call) — `lib/events`
 *   2. otherwise, IF FOOTBALL_DATA_PAID=1 (paid livescore tier) and `allowApi`,
 *      the football-data.org match detail (goals + bookings)
 *   3. otherwise sample goals (local dev) / empty
 *
 * The API path is gated on FOOTBALL_DATA_PAID — not just key presence — because
 * a *free* key is still "a key" but returns no events. So on the free tier the
 * loader never makes a network call and behaviour is identical to before; flip
 * FOOTBALL_DATA_PAID=1 alongside a paid key and live goals + cards flow through
 * with no code changes.
 */

const BASE = "https://api.football-data.org/v4";
const UPSTREAM_TTL = 30;

interface RawGoal {
  minute?: number | null;
  injuryTime?: number | null;
  type?: string | null;
  team?: { id?: number };
  scorer?: { name?: string };
  assist?: { name?: string } | null;
}
interface RawBooking {
  minute?: number | null;
  injuryTime?: number | null;
  card?: string | null;
  team?: { id?: number };
  player?: { name?: string };
}

export async function loadMatchEvents(
  match: Match,
  { allowApi = true }: { allowApi?: boolean } = {}
): Promise<Pick<MatchDetail, "source" | "goals" | "cards">> {
  // 1. Curated ▸ scraped (no network).
  const curated = getMatchEvents(match.homeTeam, match.awayTeam);
  if (curated && (curated.goals.length || curated.cards.length)) {
    return { source: "curated", ...curated };
  }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  const paid = process.env.FOOTBALL_DATA_PAID === "1";

  // 2. Not on a paid tier (or not allowed here) → sample/empty, no network call.
  //    The free tier returns no match events, so we don't waste a request on it.
  if (!apiKey || !allowApi || !paid) {
    return { source: "sample", goals: SAMPLE_GOALS[match.id] ?? [], cards: [] };
  }

  // 3. Paid tier: pull live/finished events from the match detail endpoint.
  try {
    const res = await fetch(`${BASE}/matches/${match.id}`, {
      headers: { "X-Auth-Token": apiKey },
      next: { revalidate: UPSTREAM_TTL },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`football-data.org ${res.status}: ${body.slice(0, 160)}`);
    }
    const data = await res.json();
    const homeId: number | undefined = data.homeTeam?.id;
    const side = (teamId?: number): "home" | "away" =>
      teamId != null && teamId === homeId ? "home" : "away";

    const rawGoals: RawGoal[] = Array.isArray(data.goals) ? data.goals : [];
    const goals: Goal[] = rawGoals.map((g) => ({
      minute: g.minute ?? null,
      injuryTime: g.injuryTime ?? null,
      side: side(g.team?.id),
      scorer: g.scorer?.name || "Unknown",
      assist: g.assist?.name ?? null,
      type: g.type ?? null,
    }));

    const rawCards: RawBooking[] = Array.isArray(data.bookings) ? data.bookings : [];
    const cards: Card[] = rawCards.map((b) => ({
      minute: b.minute ?? null,
      injuryTime: b.injuryTime ?? null,
      side: side(b.team?.id),
      player: b.player?.name || "Unknown",
      // Defensive: accept "RED"/"YELLOW" or "RED_CARD"/"YELLOW_CARD".
      type: /red/i.test(b.card || "") ? "RED" : "YELLOW",
    }));

    return { source: "football-data.org", goals, cards };
  } catch {
    return { source: "sample", goals: SAMPLE_GOALS[match.id] ?? [], cards: [] };
  }
}
