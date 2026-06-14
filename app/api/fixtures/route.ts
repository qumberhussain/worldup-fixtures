import { NextResponse } from "next/server";
import { loadFixtures, type FixturesMeta } from "@/lib/fixtures";
import type { FixturesPayload } from "@/lib/types";

// Always run on each request; loadFixtures caches the *upstream* call itself so
// the browser can poll frequently without burning the free-tier rate limit.
export const dynamic = "force-dynamic";

export async function GET() {
  const { payload, meta } = await loadFixtures();
  return json(payload, meta);
}

function json(payload: FixturesPayload, extra?: FixturesMeta) {
  return NextResponse.json(
    { ...payload, ...extra },
    {
      headers: {
        // Let the browser/CDN reuse for a few seconds; SWR keeps it feeling live.
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
      },
    }
  );
}
