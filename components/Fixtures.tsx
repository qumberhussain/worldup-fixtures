"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { classify, decidedOnPenalties, hasScore, wentToExtraTime, winnerSide } from "@/lib/normalize";
import { channelNetwork, channelServices, teamCode } from "@/lib/channels";
import { matchSlug } from "@/lib/slug";
import { computeStandings, fmtGD, groupLabel, type GroupTable } from "@/lib/standings";
import type { Card, FixturesPayload, Goal, Match, MatchKind, Team } from "@/lib/types";

// Adaptive polling cadence — only refresh quickly when it matters.
const POLL_LIVE = 15_000; // a match is in play
const POLL_SOON = 60_000; // a match kicks off within 30 min (or just started)
const POLL_IDLE = 300_000; // nothing live or imminent

type View = "upcoming" | "results" | "england" | "all";

const VIEW_LABELS: Record<View, string> = {
  upcoming: "Upcoming",
  results: "Results",
  england: "England",
  all: "All",
};

function isEngland(m: Match): boolean {
  return (
    m.homeTeam?.tla === "ENG" || m.awayTeam?.tla === "ENG" ||
    m.homeTeam?.name === "England" || m.awayTeam?.name === "England"
  );
}

/** Choose the next poll delay from the current fixtures. */
function pollDelay(matches: Match[]): number {
  if (matches.some((m) => {
    const k = classify(m);
    return k === "live" || k === "underway";
  })) return POLL_LIVE;
  const now = Date.now();
  const soon = matches.some((m) => {
    const dt = new Date(m.utcDate).getTime() - now;
    return dt < 30 * 60_000 && dt > -3 * 60 * 60_000; // 30 min before .. 3h after KO
  });
  return soon ? POLL_SOON : POLL_IDLE;
}

export default function Fixtures({ initial }: { initial?: FixturesPayload }) {
  const [payload, setPayload] = useState<FixturesPayload | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("upcoming");
  const [query, setQuery] = useState("");
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [, forceTick] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestMatches = useRef<Match[]>(initial?.matches ?? []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/fixtures", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: FixturesPayload = await res.json();
      setPayload(data);
      latestMatches.current = data.matches ?? [];
      setFetchedAt(Date.now());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load fixtures");
    }
  }, []);

  // Reveal the live, locale-aware UI only after mount so the server-rendered
  // HTML (which can't know the viewer's timezone or "now") matches the first
  // client render — avoids hydration mismatches on kick-off times and live state.
  useEffect(() => {
    setMounted(true);
    if (initial) setFetchedAt(Date.now());
  }, [initial]);

  // Initial load + adaptive polling. Pause when the tab is hidden, refresh on return.
  useEffect(() => {
    let active = true;
    const tick = async () => {
      if (active && !document.hidden) await load();
      timer.current = setTimeout(tick, pollDelay(latestMatches.current));
    };
    // If seeded with SSR data, wait one poll interval before the first refresh;
    // otherwise fetch immediately.
    if (initial) {
      timer.current = setTimeout(tick, pollDelay(latestMatches.current));
    } else {
      tick();
    }
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, initial]);

  // Re-render every second so the "updated Ns ago" label stays current.
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const matches = payload?.matches ?? [];
  const isLiveSource = payload?.source === "football-data.org";

  // Group tables computed once from the matches we already hold, so each card
  // can reveal its group's standings inline — no extra fetch, no page nav.
  const standingsByGroup = useMemo(() => {
    const byGroup = new Map<string, GroupTable>();
    for (const t of computeStandings(matches)) byGroup.set(t.group, t);
    return byGroup;
  }, [matches]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return matches.filter((m) => {
      if (!q) return true;
      return [
        m.homeTeam?.name, m.awayTeam?.name, m.homeTeam?.tla, m.awayTeam?.tla,
        m.group, m.venue, m.stage,
      ].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [matches, query]);

  const liveMatches = useMemo(
    () => matches.filter((m) => {
      const k = classify(m);
      return k === "live" || k === "underway";
    }),
    [matches]
  );

  const list = useMemo(() => {
    let l = filtered;
    if (view === "upcoming") {
      l = l.filter((m) => classify(m) !== "played");
      l = [...l].sort((a, b) => +new Date(a.utcDate) - +new Date(b.utcDate));
    } else if (view === "results") {
      l = l.filter((m) => classify(m) === "played");
      l = [...l].sort((a, b) => +new Date(b.utcDate) - +new Date(a.utcDate));
    } else if (view === "england") {
      l = l.filter(isEngland);
      l = [...l].sort((a, b) => +new Date(a.utcDate) - +new Date(b.utcDate));
    } else {
      l = [...l].sort((a, b) => +new Date(a.utcDate) - +new Date(b.utcDate));
    }
    return l;
  }, [filtered, view]);

  const groups = useMemo(() => groupByDay(list), [list]);

  return (
    <>
      <div className="controls">
        <nav className="tabs" role="tablist" aria-label="Match views">
          {(["upcoming", "results", "england", "all"] as View[]).map((v) => (
            <button
              key={v}
              className={`tab ${view === v ? "is-active" : ""}`}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </nav>
        <input
          className="search"
          type="search"
          placeholder="Filter by team, group or venue…"
          aria-label="Filter matches"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <StatusBar
        isLiveSource={isLiveSource}
        fetchedAt={fetchedAt}
        loaded={payload != null}
        error={error}
      />

      {!mounted ? (
        <Skeleton />
      ) : (
        <>
          {liveMatches.length > 0 && (
            <div className="live-strip">
              {liveMatches.map((m) => (
                <div className="live-chip" key={m.id}>
                  <span className="live-tag">
                    {m.minute != null ? `${m.minute}${m.injuryTime ? `+${m.injuryTime}` : ""}'` : "LIVE"}
                  </span>
                  <div className="lc-teams">
                    {m.homeTeam?.tla || m.homeTeam?.name}{" "}
                    <span className="lc-score">
                      {hasScore(m) ? `${m.score.home}–${m.score.away}` : "vs"}
                    </span>{" "}
                    {m.awayTeam?.tla || m.awayTeam?.name}
                  </div>
                </div>
              ))}
            </div>
          )}

          <section className="content" aria-live="polite">
            {payload == null && !error && <Skeleton />}
            {payload != null && list.length === 0 && <EmptyState view={view} />}
            {groups.map(({ key, label, items }) => (
              <div className="day-group" key={key}>
                <div className="day-head">
                  <h2>{label}</h2>
                  <span className="day-sub">
                    {items.length} match{items.length > 1 ? "es" : ""}
                  </span>
                </div>
                {items.map((m) => (
                  <MatchCard
                    key={m.id}
                    m={m}
                    groupTable={m.group ? standingsByGroup.get(m.group) : undefined}
                  />
                ))}
              </div>
            ))}
          </section>
        </>
      )}
    </>
  );
}

function StatusBar({
  isLiveSource, fetchedAt, loaded, error,
}: {
  isLiveSource: boolean; fetchedAt: number | null; loaded: boolean; error: string | null;
}) {
  let label: string;
  if (error && !loaded) label = "Connection error — retrying";
  else if (!loaded) label = "Loading…";
  else if (!isLiveSource) label = "Sample data (no API key configured)";
  else label = `Live · updated ${agoLabel(fetchedAt)}`;

  const dotClass = !loaded
    ? ""
    : isLiveSource
      ? "live-source"
      : "sample-source";

  return (
    <div className="statusbar">
      <span className={`status-dot ${dotClass}`} />
      <span>{label}</span>
    </div>
  );
}

function MatchCard({ m, groupTable }: { m: Match; groupTable?: GroupTable }) {
  const kind: MatchKind = classify(m);
  const h = m.homeTeam, a = m.awayTeam;
  // A penalty win counts as a win even though the headline score is level.
  const winner = kind === "played" ? winnerSide(m) : null;
  const homeWin = winner === "home";
  const awayWin = winner === "away";
  const canExpand = kind === "played" || kind === "live" || kind === "underway";

  const [expanded, setExpanded] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [detail, setDetail] = useState<{ goals: Goal[]; cards: Card[] } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Fetch events on first expand; re-fetch live matches when the score changes.
  useEffect(() => {
    if (!expanded) return;
    let active = true;
    setLoadingDetail(true);
    fetch(`/api/match/${m.id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { goals?: Goal[]; cards?: Card[] }) => {
        if (active) {
          setDetail({
            goals: Array.isArray(d.goals) ? d.goals : [],
            cards: Array.isArray(d.cards) ? d.cards : [],
          });
        }
      })
      .catch(() => active && setDetail({ goals: [], cards: [] }))
      .finally(() => active && setLoadingDetail(false));
    return () => {
      active = false;
    };
  }, [expanded, m.id, m.score?.home, m.score?.away]);

  const hasMeta = m.group || m.venue || m.channel || (m.stage && m.stage !== "GROUP_STAGE");

  return (
    <article
      className={`match ${kind === "live" ? "is-live" : ""} ${kind === "underway" ? "is-underway" : ""}`}
    >
      <div className={`team home ${homeWin ? "winner" : ""}`}>
        <span className="name">{h?.name || "TBD"}</span>
        <TeamMark team={h} />
      </div>
      <div className="center">
        {kind === "upcoming" ? (
          <>
            <div className="kickoff">{kickoffTime(m.utcDate)}</div>
            <span className="badge upcoming">Upcoming</span>
          </>
        ) : kind === "underway" ? (
          <>
            {hasScore(m) && (
              <div className="score">
                {m.score.home}
                <span className="dash">–</span>
                {m.score.away}
              </div>
            )}
            <span className="badge inplay">● In progress</span>
            {!hasScore(m) && <div className="ko-note">Live score unavailable</div>}
          </>
        ) : (
          <>
            <div className="score">
              {m.score?.home ?? 0}
              <span className="dash">–</span>
              {m.score?.away ?? 0}
            </div>
            {kind === "live" ? (
              <>
                <span className="badge live">
                  {m.minute != null
                    ? `● ${m.minute}${m.injuryTime ? `+${m.injuryTime}` : ""}'`
                    : "● Live"}
                </span>
                <time
                  className="ko-time"
                  dateTime={m.utcDate}
                  aria-label={`Kicked off at ${kickoffTime(m.utcDate)}`}
                >
                  KO {kickoffTime(m.utcDate)}
                </time>
              </>
            ) : wentToExtraTime(m) ? (
              <span className="aet-note">AET</span>
            ) : (
              <span className="badge ft">Full time</span>
            )}
            <PensNote m={m} home={h} away={a} />
          </>
        )}
      </div>
      <div className={`team away ${awayWin ? "winner" : ""}`}>
        <TeamMark team={a} />
        <span className="name">{a?.name || "TBD"}</span>
      </div>

      {hasMeta && (
        <div className="match-meta">
          {m.group && <span>🏆 {groupLabel(m.group)}</span>}
          {m.stage && m.stage !== "GROUP_STAGE" && <span>{prettyStage(m.stage)}</span>}
          {m.venue && <span>📍 {m.venue}</span>}
          {m.channel && <ChannelTag channel={m.channel} />}
        </div>
      )}

      {m.group && groupTable && groupTable.rows.length > 0 && (
        <div className="group-section">
          <button
            className="goals-toggle"
            aria-expanded={groupOpen}
            onClick={() => setGroupOpen((v) => !v)}
          >
            {groupOpen ? "Hide" : groupLabel(m.group)} table{" "}
            <span className="chev">{groupOpen ? "▴" : "▾"}</span>
          </button>
          {groupOpen && (
            <GroupMiniTable
              table={groupTable}
              highlight={
                new Set(
                  [teamCode(h), teamCode(a)].filter((t): t is string => Boolean(t))
                )
              }
            />
          )}
        </div>
      )}

      {canExpand && (
        <div className="goals-section">
          <button
            className="goals-toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Hide events" : "Match events"}{" "}
            <span className="chev">{expanded ? "▴" : "▾"}</span>
          </button>
          {expanded && (
            <EventList detail={detail} loading={loadingDetail} home={h} away={a} />
          )}
        </div>
      )}

      <div className="match-foot">
        <Link
          className="match-link"
          href={`/match/${matchSlug(m)}`}
          aria-label={`${h?.name || "TBD"} vs ${a?.name || "TBD"} — full match page`}
        >
          Match page →
        </Link>
      </div>
    </article>
  );
}

/** "<Winner> win X–Y on pens" line, shown under the score for shootout results. */
function PensNote({ m, home, away }: { m: Match; home: Team; away: Team }) {
  if (!decidedOnPenalties(m)) return null;
  const ph = m.penalties!.home!, pa = m.penalties!.away!;
  const winnerHome = ph > pa;
  const winner = winnerHome ? home : away;
  const wName = winner?.name || winner?.tla || "Winner";
  return (
    <div className="pens-note">
      <strong>{wName}</strong> win {Math.max(ph, pa)}–{Math.min(ph, pa)} on pens
    </div>
  );
}

/** Compact group table shown inline on a match card; the two teams in this
 *  match are highlighted. Columns are kept to P / GD / Pts to stay readable. */
function GroupMiniTable({ table, highlight }: { table: GroupTable; highlight: Set<string> }) {
  return (
    <div className="group-reveal table-scroll">
      <table className="standings-table mini">
        <thead>
          <tr>
            <th scope="col" className="c-pos">#</th>
            <th scope="col" className="c-team">Team</th>
            <th scope="col"><abbr title="Played">P</abbr></th>
            <th scope="col"><abbr title="Goal difference">GD</abbr></th>
            <th scope="col" className="c-pts"><abbr title="Points">Pts</abbr></th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={r.tla} className={highlight.has(r.tla) ? "is-current" : ""}>
              <td className="c-pos">{i + 1}</td>
              <td className="c-team">
                <span className="st-team">
                  <span className="st-tla" aria-hidden="true">{r.tla}</span>
                  <span className="st-name">{r.team.name}</span>
                </span>
              </td>
              <td>{r.played}</td>
              <td>{fmtGD(r.goalDifference)}</td>
              <td className="c-pts">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type TimelineItem =
  | { kind: "goal"; minute: number | null; injuryTime: number | null; side: "home" | "away"; data: Goal }
  | { kind: "card"; minute: number | null; injuryTime: number | null; side: "home" | "away"; data: Card };

function EventList({
  detail, loading, home, away,
}: {
  detail: { goals: Goal[]; cards: Card[] } | null; loading: boolean; home: Team; away: Team;
}) {
  if (loading && detail == null) return <div className="goals-empty">Loading match events…</div>;
  if (!detail || (detail.goals.length === 0 && detail.cards.length === 0)) {
    return <div className="goals-empty">No events recorded.</div>;
  }

  const items: TimelineItem[] = [
    ...detail.goals.map((g) => ({
      kind: "goal" as const, minute: g.minute, injuryTime: g.injuryTime, side: g.side, data: g,
    })),
    ...detail.cards.map((c) => ({
      kind: "card" as const, minute: c.minute, injuryTime: c.injuryTime, side: c.side, data: c,
    })),
  ].sort((a, b) => order(a) - order(b));

  const teamTag = (side: "home" | "away") => {
    const team = side === "home" ? home : away;
    return team?.tla || (team?.name ? team.name.slice(0, 3).toUpperCase() : "");
  };

  return (
    <ul className="goals-list">
      {items.map((it, i) => {
        const min = it.minute != null ? `${it.minute}${it.injuryTime ? `+${it.injuryTime}` : ""}'` : "";
        if (it.kind === "goal") {
          const g = it.data;
          const extra = g.type === "PENALTY" ? " (pen)" : g.type === "OWN" ? " (OG)" : "";
          return (
            <li key={i} className={`goal ${it.side}`}>
              <span className="goal-min">{min}</span>
              <span className="goal-ball">⚽</span>
              <span className="goal-scorer">
                {g.scorer}
                {extra}
                {g.assist && <span className="goal-assist"> · assist {g.assist}</span>}
              </span>
              <span className="goal-team">{teamTag(it.side)}</span>
            </li>
          );
        }
        const c = it.data;
        return (
          <li key={i} className={`goal ${it.side}`}>
            <span className="goal-min">{min}</span>
            <span className={`card-mark ${c.type === "RED" ? "red" : "yellow"}`} aria-hidden="true" />
            <span className="goal-scorer">
              {c.player}
              <span className="goal-assist"> · {c.type === "RED" ? "red card" : "yellow card"}</span>
            </span>
            <span className="goal-team">{teamTag(it.side)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Sort key: chronological by minute then stoppage time. */
function order(it: TimelineItem): number {
  return (it.minute ?? 0) * 100 + (it.injuryTime ?? 0);
}

function ChannelTag({ channel }: { channel: string }) {
  const net = channelNetwork(channel);
  if (!net) return <span className="channel">📺 {channel}</span>;
  // Split "BBC One" -> logo "BBC" + name "One"; "ITV1" -> "ITV" + "1".
  const rest = channel.replace(/^bbc\s*/i, "").replace(/^itv\s*/i, "").trim();
  const services = channelServices(channel);
  return (
    <span className="channel-wrap">
      <span className={`channel-tag ${net}`}>
        <span className="ch-logo">{net === "bbc" ? "BBC" : "ITV"}</span>
        {rest && <span className="ch-name">{rest}</span>}
      </span>
      {services.map((s) => (
        <span key={s} className="ch-service">{s}</span>
      ))}
    </span>
  );
}

function TeamMark({ team }: { team: Match["homeTeam"] }) {
  if (team?.crest) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="crest" src={team.crest} alt="" loading="lazy" />;
  }
  const fallback = team?.tla || (team?.name ? team.name.slice(0, 3).toUpperCase() : "—");
  return <span className="tla">{fallback}</span>;
}

function Skeleton() {
  return (
    <div className="skeleton-list">
      <div className="skeleton-card" />
      <div className="skeleton-card" />
      <div className="skeleton-card" />
    </div>
  );
}

function EmptyState({ view }: { view: View }) {
  const map: Record<View, [string, string, string]> = {
    upcoming: ["📅", "No upcoming matches", "Check the Results tab or adjust your filter."],
    results: ["⚽", "No results yet", "Played matches appear here once games finish."],
    england: ["🏴", "No England matches", "England's fixtures will appear here."],
    all: ["🔍", "Nothing to show", "Try clearing your filter."],
  };
  const [emoji, title, sub] = map[view];
  return (
    <div className="state">
      <span className="emoji">{emoji}</span>
      <h3>{title}</h3>
      <p>{sub}</p>
    </div>
  );
}

/* ---------- helpers ---------- */

function groupByDay(list: Match[]) {
  const groups: { key: string; label: string; items: Match[] }[] = [];
  const index = new Map<string, number>();
  for (const m of list) {
    const d = new Date(m.utcDate);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!index.has(key)) {
      index.set(key, groups.length);
      groups.push({ key, label: dayLabel(d), items: [] });
    }
    groups[index.get(key)!].items.push(m);
  }
  return groups;
}

function dayLabel(d: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const diff = Math.round((+that - +today) / 86_400_000);
  const rel = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : null;
  const full = d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  return rel ? `${rel} · ${full}` : full;
}

function kickoffTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function prettyStage(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function agoLabel(ts: number | null) {
  if (!ts) return "just now";
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return `${m}m ago`;
}
