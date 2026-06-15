/**
 * Central site config — single source of truth for SEO metadata, the sitemap,
 * robots, the web manifest and JSON-LD. The production URL is read from
 * NEXT_PUBLIC_SITE_URL (set this in Vercel) and falls back to the default
 * deployment so canonical/OG/sitemap links are always absolute and correct.
 */
const RAW_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://worldcup2026-fixtures.vercel.app";

/** Absolute site origin, no trailing slash (e.g. https://example.com). */
export const SITE_URL = RAW_URL.replace(/\/+$/, "");

export const SITE = {
  url: SITE_URL,
  name: "World Cup 2026 Live",
  shortName: "WC 2026",
  title: "World Cup 2026 — Live Scores, Fixtures, Results & UK TV Guide",
  description:
    "Live in-play scores, upcoming fixtures, full results with goal scorers and " +
    "cards, plus the UK TV channel (BBC/ITV) for every FIFA World Cup 2026 match. " +
    "Kick-off times shown in your local timezone, auto-refreshing live.",
  /** Short description for OG/Twitter cards (keep under ~200 chars). */
  tagline:
    "Live scores, fixtures, results & the UK TV channel for every FIFA World Cup 2026 match.",
  locale: "en_GB",
  themeColor: "#0b1220",
  keywords: [
    "World Cup 2026",
    "FIFA World Cup 2026",
    "World Cup 2026 fixtures",
    "World Cup 2026 live scores",
    "World Cup 2026 results",
    "World Cup 2026 schedule",
    "World Cup 2026 TV channel UK",
    "World Cup 2026 BBC ITV",
    "World Cup 2026 kick off times",
    "England World Cup 2026 fixtures",
    "live football scores",
    "World Cup 2026 goal scorers",
  ],
  twitterHandle: "", // set if/when a Twitter/X account exists, e.g. "@worldup2026"
} as const;

/** Build an absolute URL from a site-relative path. */
export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
