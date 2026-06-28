import { classify, hasScore } from "./normalize";
import { teamCode } from "./channels";
import type { Match, Team } from "./types";

/**
 * Group standings, computed from the fixtures feed we already load — there is no
 * free standings API, but a league table is fully derivable from played group
 * matches (the same data the homepage shows). Keyed off the FIFA code (TLA) like
 * everything else in the app (see `teamCode` in lib/channels.ts).
 *
 * Tie-break order here is **points → goal difference → goals for → name**. The
 * full FIFA group ranking then applies head-to-head results, fair-play points
 * and finally a drawing of lots; those need data we don't model (and are a
 * deliberate v1 omission — see PLAN.md). This covers every non-exact-tie case,
 * which is the overwhelming majority, and keeps the comparator transitive.
 */
export interface StandingRow {
  /** Full team (name + crest) for display. */
  team: Team;
  /** Resolved FIFA code — the join key. */
  tla: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface GroupTable {
  /** e.g. "Group A". */
  group: string;
  /** Rows in ranked order (1st … last). */
  rows: StandingRow[];
}

function blankRow(team: Team, tla: string): StandingRow {
  return {
    team,
    tla,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  };
}

/** A finished group match with a real score counts toward the table. */
function isCounted(m: Match): boolean {
  return classify(m) === "played" && hasScore(m);
}

/**
 * Build a ranked table per group from all matches. Teams are seeded from every
 * group fixture (played or not), so all four show up — with zeroes — even before
 * a ball is kicked; stats are then tallied from the counted (finished) matches.
 */
export function computeStandings(matches: Match[]): GroupTable[] {
  // Knockout matches carry no `group`, so this filter is also the group filter.
  const groupMatches = matches.filter((m) => !!m.group);

  const tables = new Map<string, Map<string, StandingRow>>();
  for (const m of groupMatches) {
    const group = m.group as string;
    const table = tables.get(group) ?? new Map<string, StandingRow>();
    if (!tables.has(group)) tables.set(group, table);

    // Seed both sides so an as-yet-unplayed team still appears.
    const hTla = teamCode(m.homeTeam);
    const aTla = teamCode(m.awayTeam);
    if (hTla && !table.has(hTla)) table.set(hTla, blankRow(m.homeTeam, hTla));
    if (aTla && !table.has(aTla)) table.set(aTla, blankRow(m.awayTeam, aTla));

    if (!isCounted(m) || !hTla || !aTla) continue;
    const home = table.get(hTla)!;
    const away = table.get(aTla)!;
    const hs = m.score.home as number;
    const as = m.score.away as number;

    home.played++;
    away.played++;
    home.goalsFor += hs;
    home.goalsAgainst += as;
    away.goalsFor += as;
    away.goalsAgainst += hs;
    if (hs > as) {
      home.won++;
      away.lost++;
    } else if (hs < as) {
      away.won++;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
    }
  }

  const result: GroupTable[] = [];
  for (const [group, table] of tables) {
    const rows = [...table.values()];
    for (const r of rows) {
      r.goalDifference = r.goalsFor - r.goalsAgainst;
      r.points = r.won * 3 + r.drawn;
    }
    rows.sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor ||
        a.team.name.localeCompare(b.team.name)
    );
    result.push({ group, rows });
  }

  // "Group A" < "Group B" … (numeric-aware in case of any "Group 10"-style key).
  result.sort((a, b) => a.group.localeCompare(b.group, undefined, { numeric: true }));
  return result;
}
