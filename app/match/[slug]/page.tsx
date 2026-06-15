import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getMatchById, loadFixtures } from "@/lib/fixtures";
import { getMatchEvents } from "@/lib/events";
import { loadMatchEvents } from "@/lib/match-events";
import { buildMatchJsonLd } from "@/lib/jsonld";
import { matchSlug, parseMatchId } from "@/lib/slug";
import { classify, hasScore } from "@/lib/normalize";
import { channelServices } from "@/lib/channels";
import { absoluteUrl } from "@/lib/site";
import LiveRefresher from "@/components/LiveRefresher";
import type { Card, Goal, Match, Team } from "@/lib/types";

// Pre-render every match at build; ISR keeps scores/events fresh. Live matches
// additionally mount <LiveRefresher>, which re-renders this server component in
// place — so the timeline stays fully server-rendered (great for SEO) yet live.
export const revalidate = 30;
export const dynamicParams = true;

export async function generateStaticParams() {
  const { payload } = await loadFixtures();
  return payload.matches.map((m) => ({ slug: matchSlug(m) }));
}

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(iso));

const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
  }).format(new Date(iso));

const prettyStage = (s: string) =>
  s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function metaTitle(m: Match): string {
  const home = m.homeTeam?.name || "TBD";
  const away = m.awayTeam?.name || "TBD";
  const score = hasScore(m) ? ` (${m.score.home}–${m.score.away})` : "";
  return `${home} vs ${away}${score} — World Cup 2026`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const id = parseMatchId(slug);
  const m = id != null ? await getMatchById(id) : undefined;
  if (!m) return { title: "Match not found · World Cup 2026" };

  const home = m.homeTeam?.name || "TBD";
  const away = m.awayTeam?.name || "TBD";
  const kind = classify(m);
  const when = `${fmtDate(m.utcDate)}, ${fmtTime(m.utcDate)} UK time`;
  const channel = m.channel ? ` Watch on ${m.channel} in the UK.` : "";

  const description =
    kind === "played"
      ? `Full time: ${home} ${m.score.home}–${m.score.away} ${away}. Goal scorers, cards and details from this FIFA World Cup 2026 match.${channel}`
      : kind === "live" || kind === "underway"
        ? `LIVE: ${home} vs ${away} at the FIFA World Cup 2026 — live score, goal scorers and cards.${channel}`
        : `${home} vs ${away} at the FIFA World Cup 2026. Kick-off ${when}, plus group, venue and UK TV channel.${channel}`;

  const canonical = `/match/${matchSlug(m)}`;
  const title = metaTitle(m);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: { title, description, url: absoluteUrl(canonical), type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const id = parseMatchId(slug);
  if (id == null) notFound();

  const m = await getMatchById(id);
  if (!m) notFound();

  // Canonicalise the slug (e.g. after a knockout team is drawn).
  const canonical = matchSlug(m);
  if (slug !== canonical) redirect(`/match/${canonical}`);

  const kind = classify(m);
  const home = m.homeTeam;
  const away = m.awayTeam;
  // For in-progress matches, pull live events (paid tier); otherwise the
  // curated/scraped set. Free tier never hits the API in either path.
  const events =
    kind === "live" || kind === "underway"
      ? await loadMatchEvents(m)
      : getMatchEvents(home, away) ?? { goals: [], cards: [] };
  const jsonLd = buildMatchJsonLd(m);
  const homeWin = kind === "played" && hasScore(m) && m.score.home! > m.score.away!;
  const awayWin = kind === "played" && hasScore(m) && m.score.away! > m.score.home!;

  const { payload } = await loadFixtures();
  const related = payload.matches
    .filter((x) => x.id !== m.id && x.group && x.group === m.group)
    .slice(0, 6);

  const stageLabel = [
    m.group,
    m.stage && m.stage !== "GROUP_STAGE" ? prettyStage(m.stage) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {(kind === "live" || kind === "underway") && <LiveRefresher />}

      <header className="site-header">
        <div className="wrap">
          <a className="brand" href="/">
            <span className="brand-mark" aria-hidden="true">⚽</span>
            <div>
              <span className="brand-title">World Cup 2026</span>
              <span className="tagline">Live Fixtures &amp; Results</span>
            </div>
          </a>
        </div>
      </header>

      <main className="wrap match-page">
        <nav className="crumbs" aria-label="Breadcrumb">
          <a href="/">World Cup 2026</a>
          <span aria-hidden="true"> › </span>
          <span aria-current="page">{home?.name} vs {away?.name}</span>
        </nav>

        <article className={`match-detail ${kind === "live" ? "is-live" : ""}`}>
          {stageLabel && <div className="md-stage">🏆 {stageLabel}</div>}

          <div className="md-score-row">
            <h1 className={`md-team ${homeWin ? "winner" : ""}`}>{home?.name || "TBD"}</h1>
            <div className="md-center">
              {kind === "upcoming" ? (
                <time className="md-ko" dateTime={m.utcDate}>{fmtTime(m.utcDate)}</time>
              ) : kind === "underway" ? (
                hasScore(m) ? (
                  <div className="md-score">
                    {m.score.home}<span className="dash">–</span>{m.score.away}
                  </div>
                ) : (
                  <div className="md-note">Live score unavailable</div>
                )
              ) : (
                <div className="md-score">
                  {m.score?.home ?? 0}<span className="dash">–</span>{m.score?.away ?? 0}
                </div>
              )}
              <span
                className={`badge ${
                  kind === "live" ? "live"
                    : kind === "underway" ? "inplay"
                    : kind === "played" ? "ft"
                    : "upcoming"
                }`}
              >
                {kind === "live"
                  ? (m.minute != null ? `● ${m.minute}${m.injuryTime ? `+${m.injuryTime}` : ""}'` : "● Live")
                  : kind === "underway" ? "● In progress"
                  : kind === "played" ? "Full time"
                  : "Upcoming"}
              </span>
            </div>
            <h1 className={`md-team ${awayWin ? "winner" : ""}`}>{away?.name || "TBD"}</h1>
          </div>

          <p className="md-meta">
            <time dateTime={m.utcDate}>{fmtDate(m.utcDate)}, {fmtTime(m.utcDate)} (UK time)</time>
            {m.venue && <> · 📍 {m.venue}</>}
            {m.channel && (
              <> · 📺 {m.channel}
                {channelServices(m.channel).length > 0 && ` (${channelServices(m.channel).join(", ")})`}
              </>
            )}
          </p>

          <section className="md-events" aria-label="Match events">
            <h2>Match events</h2>
            <EventTimeline goals={events.goals} cards={events.cards} home={home} away={away} />
          </section>
        </article>

        {related.length > 0 && (
          <section className="md-related">
            <h2>More from {m.group}</h2>
            <ul>
              {related.map((r) => (
                <li key={r.id}>
                  <a href={`/match/${matchSlug(r)}`}>
                    {r.homeTeam?.name} vs {r.awayTeam?.name}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="md-back">
          <a href="/">← All fixtures &amp; results</a>
        </p>
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <p>
            Data via{" "}
            <a href="https://www.football-data.org/" rel="noopener" target="_blank">
              football-data.org
            </a>
            . Times shown in UK time.
          </p>
        </div>
      </footer>
    </>
  );
}

type Item =
  | { kind: "goal"; minute: number | null; injuryTime: number | null; side: "home" | "away"; data: Goal }
  | { kind: "card"; minute: number | null; injuryTime: number | null; side: "home" | "away"; data: Card };

const orderKey = (it: Item) => (it.minute ?? 0) * 100 + (it.injuryTime ?? 0);

function EventTimeline({
  goals, cards, home, away,
}: {
  goals: Goal[]; cards: Card[]; home: Team; away: Team;
}) {
  if (goals.length === 0 && cards.length === 0) {
    return <p className="goals-empty">No events recorded yet.</p>;
  }

  const items: Item[] = [
    ...goals.map((g) => ({ kind: "goal" as const, minute: g.minute, injuryTime: g.injuryTime, side: g.side, data: g })),
    ...cards.map((c) => ({ kind: "card" as const, minute: c.minute, injuryTime: c.injuryTime, side: c.side, data: c })),
  ].sort((a, b) => orderKey(a) - orderKey(b));

  const tag = (side: "home" | "away") => {
    const t = side === "home" ? home : away;
    return t?.tla || (t?.name ? t.name.slice(0, 3).toUpperCase() : "");
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
                {g.scorer}{extra}
                {g.assist && <span className="goal-assist"> · assist {g.assist}</span>}
              </span>
              <span className="goal-team">{tag(it.side)}</span>
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
            <span className="goal-team">{tag(it.side)}</span>
          </li>
        );
      })}
    </ul>
  );
}
