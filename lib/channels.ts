import type { Match } from "./types";

/**
 * Curated UK broadcast channels — there is no free API for this, so it's
 * maintained by hand. Keyed by an unordered team-code pair "TLA|TLA" (the
 * lookup tries both orders), since two teams only meet once in the group
 * stage. Matches without an entry simply omit the channel.
 *
 * Sources (confirmed UK BBC/ITV assignments, June 2026):
 *  - Opening game Mexico v South Africa on ITV1
 *  - England: v Croatia (ITV1), v Ghana (BBC One), v Panama (ITV1)
 *  - Scotland: v Haiti (BBC One), v Morocco (ITV1/STV), v Brazil (BBC One)
 */
export const UK_CHANNELS: Record<string, string> = {
  // --- Confirmed real fixtures ---
  "MEX|RSA": "ITV1", // Opening match, 11 Jun
  "ENG|CRO": "ITV1", // 17 Jun
  "ENG|GHA": "BBC One", // 23 Jun
  "ENG|PAN": "ITV1", // 27 Jun
  "SCO|HAI": "BBC One",
  "SCO|MAR": "ITV1", // also STV, 19 Jun
  "SCO|BRA": "BBC One", // 24 Jun

  // --- Sample/demo pairs (only used when running on sample data) ---
  "MEX|CRO": "BBC One",
  "CAN|JPN": "ITV1",
  "USA|GHA": "BBC One",
  "ENG|SEN": "ITV1",
  "BRA|MAR": "BBC Two",
  "ARG|AUS": "ITV4",
};

/** Build the unordered channel key for a pair of team codes. */
function pairKey(a?: string | null, b?: string | null): string | null {
  if (!a || !b) return null;
  return `${a}|${b}`;
}

export function getChannel(
  m: Pick<Match, "homeTeam" | "awayTeam">
): string | null {
  const home = m.homeTeam?.tla;
  const away = m.awayTeam?.tla;
  const forward = pairKey(home, away);
  const reverse = pairKey(away, home);
  return (
    (forward && UK_CHANNELS[forward]) ||
    (reverse && UK_CHANNELS[reverse]) ||
    null
  );
}
