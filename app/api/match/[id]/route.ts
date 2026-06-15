import { NextResponse } from "next/server";
import { getMatchById } from "@/lib/fixtures";
import { loadMatchEvents } from "@/lib/match-events";
import type { MatchDetail } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const matchId = Number(id);

  const match = await getMatchById(matchId);
  if (!match) {
    return json({ id: matchId, source: "sample", goals: [], cards: [] });
  }

  const { source, goals, cards } = await loadMatchEvents(match);
  return json({ id: matchId, source, goals, cards });
}

function json(payload: MatchDetail, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { ...payload, ...extra },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
  );
}
