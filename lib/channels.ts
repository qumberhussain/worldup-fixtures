import type { Match } from "./types";

/**
 * Curated UK broadcast channels — there is no free API for this, so it's
 * maintained by hand. Key format: "YYYY-MM-DD|HOME|AWAY" using the 3-letter
 * team codes (TLA), e.g. "2026-06-11|MEX|CRO". Matches without an entry show
 * "TBC". Update as the BBC/ITV schedule is confirmed.
 */
export const UK_CHANNELS: Record<string, string> = {
  "2026-06-11|MEX|CRO": "BBC One",
  "2026-06-12|CAN|JPN": "ITV1",
  "2026-06-13|USA|GHA": "BBC One",
  "2026-06-14|ENG|SEN": "ITV1",
  "2026-06-15|BRA|MAR": "BBC Two",
  "2026-06-16|ARG|AUS": "ITV4",
};

/** Build the channel-map key for a match from its date (UTC) and team codes. */
export function channelKey(m: Pick<Match, "utcDate" | "homeTeam" | "awayTeam">): string | null {
  const home = m.homeTeam?.tla;
  const away = m.awayTeam?.tla;
  if (!home || !away) return null;
  const d = new Date(m.utcDate);
  if (Number.isNaN(d.getTime())) return null;
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return `${date}|${home}|${away}`;
}

export function getChannel(m: Pick<Match, "utcDate" | "homeTeam" | "awayTeam">): string | null {
  const key = channelKey(m);
  return key ? UK_CHANNELS[key] ?? null : null;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
