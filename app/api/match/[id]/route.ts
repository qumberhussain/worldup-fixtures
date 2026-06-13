import { NextResponse } from "next/server";
import { SAMPLE_GOALS } from "@/lib/sample";
import type { Goal, MatchDetail } from "@/lib/types";

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

  // No key -> serve sample goals (if we have any for this match).
  if (!apiKey) {
    return json({ id: matchId, source: "sample", goals: SAMPLE_GOALS[matchId] ?? [] });
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

    return json({ id: matchId, source: "football-data.org", goals });
  } catch (err) {
    return json(
      { id: matchId, source: "sample", goals: SAMPLE_GOALS[matchId] ?? [] },
      { error: err instanceof Error ? err.message : "unknown error" }
    );
  }
}

function json(payload: MatchDetail, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { ...payload, ...extra },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
  );
}
