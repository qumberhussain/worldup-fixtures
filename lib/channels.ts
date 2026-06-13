import type { Match } from "./types";

/**
 * Curated UK broadcast channels — there is no free API for this, so it's
 * maintained by hand from the official BBC/ITV listings (see the uploaded
 * "World Cup 2026 Timetable UK"). Keyed by an unordered FIFA team-code pair
 * "TLA|TLA" (the lookup tries both orders), since two teams only meet once in
 * the group stage. Knockout matches use bracket placeholders with no real
 * teams yet, so they are not keyed here and show no channel until drawn.
 */
export const UK_CHANNELS: Record<string, string> = {
  "MEX|RSA": "BBC One",
  "KOR|CZE": "BBC One",
  "CAN|BIH": "BBC One",
  "USA|PAR": "BBC One",
  "QAT|SUI": "ITV1",
  "BRA|MAR": "BBC One",
  "HAI|SCO": "BBC One",
  "AUS|TUR": "ITV1",
  "GER|CUW": "ITV1",
  "NED|JPN": "ITV1",
  "CIV|ECU": "BBC One",
  "SWE|TUN": "ITV1",
  "ESP|CPV": "ITV1",
  "BEL|EGY": "BBC One",
  "KSA|URU": "ITV1",
  "IRN|NZL": "BBC One",
  "FRA|SEN": "BBC One",
  "IRQ|NOR": "BBC One",
  "ARG|ALG": "ITV1",
  "AUT|JOR": "BBC One",
  "POR|COD": "BBC One",
  "ENG|CRO": "ITV1",
  "GHA|PAN": "ITV1",
  "UZB|COL": "BBC One",
  "CZE|RSA": "BBC One",
  "SUI|BIH": "ITV1",
  "CAN|QAT": "ITV1",
  "MEX|KOR": "BBC One",
  "USA|AUS": "BBC One",
  "SCO|MAR": "ITV1",
  "BRA|HAI": "ITV1",
  "TUR|PAR": "ITV1",
  "NED|SWE": "BBC One",
  "GER|CIV": "ITV1",
  "ECU|CUW": "BBC One",
  "TUN|JPN": "BBC One",
  "ESP|KSA": "BBC One",
  "BEL|IRN": "ITV1",
  "URU|CPV": "BBC One",
  "NZL|EGY": "ITV1",
  "ARG|AUT": "BBC One",
  "FRA|IRQ": "BBC One",
  "NOR|SEN": "ITV1",
  "JOR|ALG": "ITV1",
  "POR|UZB": "ITV1",
  "ENG|GHA": "BBC One",
  "PAN|CRO": "BBC One",
  "COL|COD": "ITV1",
  "BIH|QAT": "ITV4",
  "SUI|CAN": "ITV1",
  "MAR|HAI": "BBC Two",
  "SCO|BRA": "BBC One",
  "CZE|MEX": "BBC One",
  "RSA|KOR": "BBC Two",
  "CUW|CIV": "BBC Two",
  "ECU|GER": "BBC One",
  "JPN|SWE": "BBC Two",
  "TUN|NED": "BBC One",
  "PAR|AUS": "ITV4",
  "TUR|USA": "ITV1",
  "NOR|FRA": "ITV1",
  "SEN|IRQ": "ITV4",
  "CPV|KSA": "ITV4",
  "URU|ESP": "ITV1",
  "EGY|IRN": "BBC Two",
  "NZL|BEL": "BBC One",
  "CRO|GHA": "ITV4",
  "PAN|ENG": "ITV1",
  "COL|POR": "BBC One",
  "COD|UZB": "BBC Two",
  "ALG|AUT": "BBC Two",
  "JOR|ARG": "BBC One",
};

/**
 * Team name -> FIFA code, with aliases for naming differences between the
 * timetable and the live data feed (e.g. "Korea Republic", "Türkiye").
 */
const NAME_TO_TLA: Record<string, string> = {
  "algeria": "ALG", "argentina": "ARG", "australia": "AUS", "austria": "AUT",
  "belgium": "BEL", "bosnia": "BIH", "bosnia & herzegovina": "BIH",
  "bosnia and herzegovina": "BIH", "bosnia-herzegovina": "BIH", "brazil": "BRA",
  "cabo verde": "CPV", "canada": "CAN", "cape verde": "CPV", "colombia": "COL",
  "congo": "COD", "congo dr": "COD", "cote d'ivoire": "CIV", "croatia": "CRO",
  "curacao": "CUW", "curaçao": "CUW", "czech republic": "CZE", "czechia": "CZE",
  "côte d'ivoire": "CIV", "democratic republic of congo": "COD", "dr congo": "COD",
  "ecuador": "ECU", "egypt": "EGY", "england": "ENG", "france": "FRA",
  "germany": "GER", "ghana": "GHA", "haiti": "HAI", "ir iran": "IRN", "iran": "IRN",
  "iraq": "IRQ", "ivory coast": "CIV", "japan": "JPN", "jordan": "JOR",
  "korea": "KOR", "korea republic": "KOR", "mexico": "MEX", "morocco": "MAR",
  "netherlands": "NED", "new zealand": "NZL", "norway": "NOR", "panama": "PAN",
  "paraguay": "PAR", "portugal": "POR", "qatar": "QAT", "republic of korea": "KOR",
  "saudi arabia": "KSA", "scotland": "SCO", "senegal": "SEN", "south africa": "RSA",
  "south korea": "KOR", "spain": "ESP", "sweden": "SWE", "switzerland": "SUI",
  "tunisia": "TUN", "turkey": "TUR", "turkiye": "TUR", "türkiye": "TUR",
  "united states": "USA", "united states of america": "USA", "uruguay": "URU",
  "us": "USA", "usa": "USA", "uzbekistan": "UZB",
};

/** Resolve a team to its FIFA code, preferring the name (matches our keys). */
export function teamCode(team?: Match["homeTeam"]): string | null {
  if (!team) return null;
  const byName = team.name && NAME_TO_TLA[team.name.trim().toLowerCase()];
  if (byName) return byName;
  return team.tla ? team.tla.toUpperCase() : null;
}

export function getChannel(m: Pick<Match, "homeTeam" | "awayTeam">): string | null {
  const h = teamCode(m.homeTeam);
  const a = teamCode(m.awayTeam);
  if (!h || !a) return null;
  return UK_CHANNELS[`${h}|${a}`] || UK_CHANNELS[`${a}|${h}`] || null;
}

/** Broadcaster family of a channel string, for icon/colour styling. */
export function channelNetwork(channel: string | null): "bbc" | "itv" | null {
  if (!channel) return null;
  if (channel.toUpperCase().startsWith("BBC")) return "bbc";
  if (channel.toUpperCase().startsWith("ITV")) return "itv";
  return null;
}
