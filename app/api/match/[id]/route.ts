import { NextResponse } from "next/server";
import { SAMPLE_GOALS, SAMPLE_MATCHES } from "@/lib/sample";
import { getMatchEvents } from "@/lib/events";
import type { Card, Goal, MatchDetail, Team } from "@/lib/types";

export const dynamic = "force-dynamic";

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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const matchId = Number(id);
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  // No key -> resolve teams from sample data, prefer curated events.
  if (!apiKey) {
    const m = SAMPLE_MATCHES.find((x) => x.id === matchId);
    const curated = m ? getMatchEvents(m.homeTeam, m.awayTeam) : null;
    if (curated && (curated.goals.length || curated.cards.length)) {
      return json({ id: matchId, source: "curated", ...curated });
    }
    return json({ id: matchId, source: "sample", goals: SAMPLE_GOALS[matchId] ?? [], cards: [] });
  }

  try {
    const res = await fetch(`${BASE}/matches/${matchId}`, {
      headers: { "X-Auth-Token": apiKey },
      next: { revalidate: UPSTREAM_TTL },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`football-data.org ${res.status}: ${body.slice(0, 160)}`);
    }

    const data = await res.json();
    const home = toTeam(data.homeTeam);
    const away = toTeam(data.awayTeam);

    // Prefer hand-curated events (goal scorers + cards) when we have them,
    // since the free tier returns no match events.
    const curated = getMatchEvents(home, away);
    if (curated && (curated.goals.length || curated.cards.length)) {
      return json({ id: matchId, source: "curated", ...curated });
    }

    // Otherwise fall back to whatever the API provides (goals on paid tiers).
    const homeId: number | undefined = data.homeTeam?.id;
    const rawGoals: RawGoal[] = Array.isArray(data.goals) ? data.goals : [];
    const goals: Goal[] = rawGoals.map((g) => ({
      minute: g.minute ?? null,
      injuryTime: g.injuryTime ?? null,
      side: g.team?.id != null && g.team.id === homeId ? "home" : "away",
      scorer: g.scorer?.name || "Unknown",
      assist: g.assist?.name ?? null,
      type: g.type ?? null,
    }));

    return json({ id: matchId, source: "football-data.org", goals, cards: [] });
  } catch (err) {
    return json(
      { id: matchId, source: "sample", goals: SAMPLE_GOALS[matchId] ?? [], cards: [] },
      { error: err instanceof Error ? err.message : "unknown error" }
    );
  }
}

function toTeam(t: { name?: string; tla?: string; crest?: string } | undefined): Team {
  return { name: t?.name || "TBD", tla: t?.tla || null, crest: t?.crest || "" };
}

function json(payload: MatchDetail, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { ...payload, ...extra },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
  );
}
