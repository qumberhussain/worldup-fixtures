# World Cup 2026 — Live Fixtures, Results & UK TV Guide

A Next.js web app showing **live in-play scores**, **upcoming fixtures**, **results
with goal scorers & cards**, and the **UK TV channel** for every match of the FIFA
World Cup 2026. Deployed on Vercel.

> **This README doubles as a project log / decision record.** It captures what's
> built, *why* each choice was made, the trade-offs, and a backlog of future
> features (benchmarked against BBC Sport, FlashScore, Sofascore, OneFootball,
> ESPN). Read the [Decision log](#decision-log) and [Roadmap](#roadmap-future-features)
> sections to get back up to speed quickly.

---

## What it does (features)

| Feature | Notes |
| --- | --- |
| **Live scores** | In-play matches show a live score + pulsing "LIVE" strip; the page auto-refreshes. |
| **Upcoming / Results / England / All tabs** | Filter the fixture list; **England** tab isolates England's matches. |
| **Goal scorers** | Expand any played/live match → chronological event timeline. |
| **Cards (🟨/🟥)** | Yellow/red cards interleaved into the same timeline, by minute. |
| **UK TV channel** | Per-match broadcaster badge (BBC/ITV) + streaming chips (iPlayer / ITVX / STV). |
| **Search** | Filter by team, group, or venue. |
| **Day grouping** | Matches grouped by local calendar day (Today / Tomorrow aware). |
| **Local timezone** | All kick-off times render in the viewer's timezone. |
| **Graceful fallback** | If the API key/feed is unavailable, it serves clearly-labelled sample data so the page never breaks. |

---

## Architecture

```
Browser (components/Fixtures.tsx)
  │  polls /api/fixtures  (adaptive: 15s live → 60s soon → 5min idle)
  │  on expand: GET /api/match/[id]
  ▼
Next.js API routes (server-side; the API key never reaches the browser)
  ├─ /api/fixtures      → football-data.org  (scores, schedule, status)
  │                       + merges UK channel from lib/channels.ts
  │                       + 12s module-cache throttle (rate-limit guard)
  └─ /api/match/[id]    → goals + cards from lib/events.ts
                          (curated overrides Wikipedia-scraped goals)

Cron (.github/workflows/scrape-events.yml, hourly)
  └─ scripts/scrape-events.mjs → scrapes Wikipedia → data/events.json → commit → Vercel redeploy
```

### Why these choices
- **Next.js on Vercel, not static GitHub Pages** — we need a server-side proxy to
  hide the API key and avoid CORS. Next API routes give us that in one project.
- **Server-side proxy + polling** — true "live" needs the browser to refresh, but the
  key can't be in client JS and most football APIs block browser CORS. The
  `/api/fixtures` route is the only thing that talks to the API.
- **Adaptive polling** — 15s is wasteful overnight. We poll fast only while a match is
  live/imminent, easing off to 5 min when idle. See `pollDelay()` in `Fixtures.tsx`.
- **12s throttle cache** — football-data.org free tier allows **10 calls/min**. A
  module-scoped cache in `/api/fixtures` guarantees ≤1 upstream call per 12s
  *regardless of how many visitors poll*, and serves last-good data if the API errors.

---

## Data sources & the big trade-offs

| Data | Source | How / why |
| --- | --- | --- |
| Scores, schedule, status | **football-data.org** (free tier) | Clean `status` field maps to live/finished/upcoming. Competition code `WC`. |
| UK TV channel | **Hand-curated** (`lib/channels.ts`) | No free API exists for UK broadcast rights. Populated from the official BBC/ITV timetable; keyed by FIFA team-code pair. |
| Goal scorers | **Auto-scraped from Wikipedia** (`data/events.json`) | Free tier has **no** match events. Wikipedia group pages encode goals cleanly; the cron refreshes them. |
| Cards (🟨/🟥) | **Hand-curated** (`lib/events.ts`) | Cards live in Wikipedia's lineup section with mixed teams + noisy player links — **not reliably attributable** by script. Curated entries override scraped goals and add cards. |

**Key limitation (by design, because we're avoiding paid APIs):**
- **Cards are not auto-updated.** New finished matches get **goal scorers automatically**
  (via the cron), but **cards require a manual curated entry** in `lib/events.ts`.
  A paid data tier (football-data.org paid, or API-Football) would automate cards
  *and* goals — the `/api/match/[id]` route is already wired to map API events if
  you ever upgrade.
- **Wikipedia lag** — scorers appear once Wikipedia editors fill a match box (usually
  minutes-to-an-hour after full time). Curated entries cover anything urgent.
- **Knockout channels** — the channel map only covers the **group stage**; knockout
  fixtures use bracket placeholders until teams are drawn.

---

## How automation works (the cron)

- `.github/workflows/scrape-events.yml` runs **hourly** (and on manual dispatch).
- It runs `scripts/scrape-events.mjs`, which fetches all 12 group pages from the
  Wikipedia API, parses each match's `goals1`/`goals2` (handles `{{goal}}` templates
  **and** plain-text minutes, penalties, own goals), and writes `data/events.json`
  keyed by team-code pair.
- It commits **only when the file changes**; the commit triggers a Vercel redeploy.
- **Why GitHub Actions and not Vercel Cron:** Vercel's free (Hobby) plan limits cron
  to **once per day** — too slow for a tournament. GitHub Actions cron is free and
  runs hourly. (Scheduled workflows only run from the repo's **default branch**.)

---

## Project structure

```
app/
  layout.tsx              Root layout, fonts, metadata
  page.tsx                Page shell (server component)
  globals.css             Styling (responsive dark theme)
  api/fixtures/route.ts   Proxy: scores/schedule + channel merge + throttle cache
  api/match/[id]/route.ts Match detail: goals + cards (curated ▸ scraped)
components/
  Fixtures.tsx            Client UI: polling, tabs, live strip, event timeline, channel badges
lib/
  types.ts                Shared types (Match, Goal, Card, ...)
  normalize.ts            football-data.org → app shape + match classification
  channels.ts             Curated UK channel map + team-code resolver + service helper
  events.ts               Curated goals+cards; merges Wikipedia-scraped goals
  sample.ts               Fallback fixtures + sample goals (used when no API key)
data/
  events.json             Auto-scraped goal scorers (written by the cron)
scripts/
  scrape-events.mjs       Wikipedia goal scraper (run by the cron)
.github/workflows/
  scrape-events.yml       Hourly cron
```

---

## Local development

```bash
npm install
npm run dev                                  # http://localhost:3000 (sample data)
FOOTBALL_DATA_API_KEY=yourkey npm run dev    # live data
node scripts/scrape-events.mjs               # refresh data/events.json locally
```

## Deployment (Vercel)

1. Import the repo at [vercel.com/new](https://vercel.com/new) (auto-detects Next.js).
2. Add env var **`FOOTBALL_DATA_API_KEY`** (free key from
   [football-data.org](https://www.football-data.org/client/register)). Optional:
   `COMPETITION` (defaults to `WC`).
3. Deploy. The default branch is the production branch; pushes auto-redeploy.

## Maintenance / how to update data

- **Add/fix a UK channel:** edit `UK_CHANNELS` in `lib/channels.ts` — one line, keyed
  by FIFA code pair, e.g. `"FRA|GER": "BBC Two"`. Order-independent.
- **Add cards (or correct goals) for a match:** add an entry to `MATCH_EVENTS` in
  `lib/events.ts`. Curated entries **override** the scraped goals and add cards.
- **Goals:** usually nothing to do — the cron keeps `data/events.json` fresh.

---

## Decision log (session history)

Chronological record of what changed and why, so context is recoverable:

1. **Static site → Next.js.** Started as a static GitHub Pages site with a scheduled
   data-commit. Switched to **Next.js on Vercel** so a server route could hide the API
   key and enable near-real-time polling (Pages is static-only).
2. **Live-but-safe data.** `/api/fixtures` proxies football-data.org server-side;
   browser polls it. Added a **12s module-cache** + **adaptive polling** to respect the
   free-tier 10-calls/min limit regardless of traffic.
3. **UK TV channels.** No free API → curated map from the user's official BBC/ITV
   timetable spreadsheet; all 72 group-stage matches, keyed by team pair, resolved by
   team name (with aliases) so the live feed matches.
4. **England tab + channel icons.** Added an England-only view and broadcaster badges.
5. **Goal scorers & cards.** Free tier has no events → added curated `lib/events.ts`
   (goals + cards) from match reports, shown as a chronological timeline.
6. **Automation.** Free-tier-friendly cron: a GitHub Action scrapes Wikipedia goals
   hourly into `data/events.json`; curated entries override (and supply cards).
7. **Multi-channel display.** Channel badge now shows streaming/regional extras
   (iPlayer / ITVX / STV) to match the timetable.

---

## Roadmap (future features)

Benchmarked against BBC Sport, FlashScore, Sofascore, OneFootball and ESPN. Not
committed — a backlog of ideas and where they'd slot in.

### High value / low effort
- **Group standings tables** — W/D/L, GD, points per group (compute from results).
- **Calendar export (.ics)** — "add this match/these fixtures to my calendar".
- **Knockout bracket view** — visual R32→final tree (placeholders until drawn).
- **Favourite teams** — pin teams (localStorage); a "My teams" tab like the England one.
- **Light/dark theme toggle** and a manual refresh button.
- **PWA / installable + offline** — cache last payload; "add to home screen".

### Medium effort (richer match data — likely needs a paid/secondary API)
- **Auto cards + lineups/formations** (Sofascore/FlashScore style) — upgrade the data
  tier or add API-Football; the match route is already structured for events.
- **Match stats** — possession, shots, xG, corners; **head-to-head** history.
- **Live text commentary / minute-by-minute** (BBC Sport style).
- **Player & team pages** — squad lists, goals/assists leaderboards, cards tally.
- **Win-probability / live odds** style indicators.

### Platform / UX
- **Push notifications** for goals & kick-offs (favourite teams) — needs a push service.
- **Multi-timezone display** and an **i18n**/multi-language layer.
- **Other broadcasters / regions** — extend the channel map beyond UK (e.g. US, AU),
  or per-region detection.
- **Shareable match cards** (OG images) and deep links to a single match.
- **Accessibility pass** — full keyboard nav, ARIA on the timeline, reduced-motion.
- **Analytics** (privacy-friendly) to see which views/matches are used.

### Data integrity
- **Replace curated channels/cards with an API** once a budget exists, keeping the
  curated files as fallback/override.
- **Scraper hardening** — handle knockout pages, more Wikipedia formatting variants,
  and surface a "last updated" indicator sourced from `data/events.json`.

---

*Data via [football-data.org](https://www.football-data.org/) and Wikipedia. UK TV
listings curated from published BBC/ITV schedules.*
