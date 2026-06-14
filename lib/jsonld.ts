import type { Match } from "./types";
import { SITE, absoluteUrl } from "./site";
import { matchSlug } from "./slug";

function hasScore(m: Match): boolean {
  return m.score?.home != null && m.score?.away != null;
}

/**
 * Build Schema.org JSON-LD for the homepage. Search engines (esp. Google's
 * sports rich results) read this machine-readable graph regardless of whether
 * they execute our client-side JS, so it's the highest-value SEO signal here.
 *
 * We emit one `@graph` containing:
 *  - WebSite + Organization (site identity / sitelinks)
 *  - the tournament as a parent SportsEvent
 *  - one SportsEvent per match with two real (non-placeholder) teams
 */

const TOURNAMENT_ID = `${SITE.url}/#worldcup2026`;
const ORG_ID = `${SITE.url}/#organization`;
const WEBSITE_ID = `${SITE.url}/#website`;

function isReal(name?: string | null): boolean {
  if (!name) return false;
  const n = name.trim().toLowerCase();
  return n !== "" && n !== "tbd" && !n.includes("winner") && !n.includes("runner");
}

function eventStatus(status: string): string {
  switch (status) {
    case "POSTPONED":
      return "https://schema.org/EventPostponed";
    case "CANCELLED":
      return "https://schema.org/EventCancelled";
    case "SUSPENDED":
      return "https://schema.org/EventRescheduled";
    default:
      return "https://schema.org/EventScheduled";
  }
}

function sportsEvent(m: Match) {
  const home = m.homeTeam?.name ?? "TBD";
  const away = m.awayTeam?.name ?? "TBD";
  const stage =
    m.stage && m.stage !== "GROUP_STAGE"
      ? m.stage.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
      : m.group || "Group Stage";

  const scoreText = hasScore(m)
    ? ` Final score: ${home} ${m.score.home}–${m.score.away} ${away}.`
    : "";

  const node: Record<string, unknown> = {
    "@type": "SportsEvent",
    name: `${home} vs ${away}`,
    description: `FIFA World Cup 2026 ${stage}: ${home} vs ${away}.${scoreText}${
      m.channel ? ` Live on ${m.channel} in the UK.` : ""
    }`,
    sport: "Association football",
    startDate: m.utcDate,
    eventStatus: eventStatus(m.status),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url: absoluteUrl(`/match/${matchSlug(m)}`),
    isAccessibleForFree: true,
    superEvent: { "@id": TOURNAMENT_ID },
    homeTeam: { "@type": "SportsTeam", name: home },
    awayTeam: { "@type": "SportsTeam", name: away },
    competitor: [
      { "@type": "SportsTeam", name: home },
      { "@type": "SportsTeam", name: away },
    ],
    organizer: { "@id": ORG_ID },
  };

  if (m.venue) {
    node.location = { "@type": "Place", name: m.venue };
  }
  if (m.channel) {
    node.publication = {
      "@type": "BroadcastEvent",
      name: `${home} vs ${away} on ${m.channel}`,
      isLiveBroadcast: true,
      publishedOn: { "@type": "BroadcastService", name: m.channel },
    };
  }
  return node;
}

/** Per-match JSON-LD: the SportsEvent (with a stable @id) + a breadcrumb. */
export function buildMatchJsonLd(m: Match) {
  const url = absoluteUrl(`/match/${matchSlug(m)}`);
  const event = sportsEvent(m);
  return {
    "@context": "https://schema.org",
    "@graph": [
      { ...event, "@id": `${url}#event` },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "World Cup 2026", item: SITE.url },
          { "@type": "ListItem", position: 2, name: event.name, item: url },
        ],
      },
    ],
  };
}

export function buildHomeJsonLd(matches: Match[]) {
  const events = matches
    .filter((m) => isReal(m.homeTeam?.name) && isReal(m.awayTeam?.name))
    .map(sportsEvent);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: SITE.name,
        url: SITE.url,
        logo: absoluteUrl("/icon.svg"),
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: SITE.name,
        url: SITE.url,
        description: SITE.description,
        inLanguage: "en-GB",
        publisher: { "@id": ORG_ID },
      },
      {
        "@type": "SportsEvent",
        "@id": TOURNAMENT_ID,
        name: "FIFA World Cup 2026",
        alternateName: "2026 FIFA World Cup",
        sport: "Association football",
        description:
          "The 23rd FIFA World Cup, hosted across the United States, Canada and Mexico in June and July 2026.",
        startDate: "2026-06-11",
        endDate: "2026-07-19",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        url: SITE.url,
        organizer: { "@id": ORG_ID },
        location: [
          { "@type": "Country", name: "United States" },
          { "@type": "Country", name: "Canada" },
          { "@type": "Country", name: "Mexico" },
        ],
        subEvent: events,
      },
      ...events,
    ],
  };
}
