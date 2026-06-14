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
Browser
  ├─ app/page.tsx (SSR, ISR 30s) → lib/fixtures.loadFixtures()
  │     seeds <Fixtures> with initial data (no empty flash for crawlers/users)
  │     + emits SportsEvent JSON-LD for Google sports rich results
  └─ components/Fixtures.tsx
        │  polls /api/fixtures  (adaptive: 15s live → 60s soon → 5min idle)
        │  on expand: GET /api/match/[id]
        ▼
Next.js API routes (server-side; the API key never reaches the browser)
  ├─ /api/fixtures      → lib/fixtures.ts → football-data.org (scores/schedule)
  │                       + merges UK channel from lib/channels.ts
  │                       + 12s module-cache throttle, SHARED with the SSR render
  │                       (so page render + polling = one upstream call max)
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
| Cards (🟨/🟥) | **Auto-scraped from Wikipedia** (`data/events.json`) | Parsed from the 2-column lineup tables. Team attribution is validated against hand-verified matches; `lib/events.ts` can still override per match for corrections. |

**Key limitation (by design, because we're avoiding paid APIs):**
- **Wikipedia lag** — scorers/cards appear once Wikipedia editors fill a match box
  (usually minutes-to-an-hour after full time), then the hourly cron picks them up.
  Add an override entry in `lib/events.ts` for anything urgent.
- **Stale "live" status** — the free feed lags the FINISHED flag, so `classify()`
  stops trusting an `IN_PLAY` status past a realistic match duration (140 min group,
  200 min knockout) and treats it as a result instead.
- A paid data tier (football-data.org paid, or API-Football) would give official
  real-time events and statuses — the `/api/match/[id]` route is already wired to
  map API events if you ever upgrade.
- **Knockout channels** — the channel map only covers the **group stage**; knockout
  fixtures use bracket placeholders until teams are drawn.

---

## How automation works (the cron)

- `.github/workflows/scrape-events.yml` runs **hourly** (and on manual dispatch).
- It runs `scripts/scrape-events.mjs`, which fetches all 12 group pages from the
  Wikipedia API, parses each match's `goals1`/`goals2` (handles `{{goal}}` templates
  **and** plain-text minutes, penalties, own goals) **and cards** (from the 2-column
  lineup tables, `{{yel}}`/`{{sent off}}`), and writes `data/events.json` keyed by
  team-code pair.
- It commits **only when the file changes**; the commit triggers a Vercel redeploy.
- **Why GitHub Actions and not Vercel Cron:** Vercel's free (Hobby) plan limits cron
  to **once per day** — too slow for a tournament. GitHub Actions cron is free and
  runs hourly. (Scheduled workflows only run from the repo's **default branch**.)

---

## SEO & analytics

**Goal:** be easily found on Google and understand traffic. The fixture list is
client-rendered (it needs the viewer's timezone + live "now"), so a naive SPA
serves crawlers an empty `<body>`. We fix that on three fronts:

1. **Server-rendered content + structured data.** `app/page.tsx` is a server
   component that calls `lib/fixtures.loadFixtures()` and:
   - **seeds** `<Fixtures>` with the initial payload, so the first HTML already
     carries real content (and there's no skeleton flash for users either);
   - emits **`SportsEvent` JSON-LD** (`lib/jsonld.ts`) — one event per match plus
     the tournament and `WebSite`/`Organization` nodes. This is the highest-value
     signal: Google reads it for **sports rich results** regardless of JS.
   - To avoid hydration mismatches, `<Fixtures>` only renders timezone-/now-
     dependent UI **after mount** (server HTML shows a skeleton; the seeded data
     paints instantly on hydration). The page is **ISR (`revalidate = 30`)** so the
     CDN serves fresh, content-rich markup cheaply.
2. **Complete metadata** (`app/layout.tsx` + `lib/site.ts`): title template,
   keyword-rich description, canonical, `robots`/`googlebot` directives, Open
   Graph + Twitter `summary_large_image`, theme colour, web manifest. Plus
   file-convention routes: `robots.ts`, `sitemap.ts`, `manifest.ts`, an SVG
   favicon, an Apple touch icon, and a **dynamically generated OG share card**
   (`opengraph-image.tsx` via `next/og`).
3. **Analytics — both, by design:**
   - **Vercel Web Analytics + Speed Insights** (`@vercel/analytics`,
     `@vercel/speed-insights`) — cookieless, privacy-friendly, real-time visits +
     Core Web Vitals. Just enable them in the Vercel dashboard; the components are
     always mounted in `layout.tsx`.
   - **Google Analytics 4** (`@next/third-parties/google`) — deeper traffic
     analysis and pairs with **Google Search Console** for the "easily googled"
     goal. Loads **only when `NEXT_PUBLIC_GA_ID` is set**, so dev/preview stay clean.

**The canonical origin** is read from `NEXT_PUBLIC_SITE_URL` (falls back to the
Vercel URL) and drives every absolute link — canonical tags, OG image, sitemap,
robots, JSON-LD. Set it once when a custom domain is added.

**After deploy:** verify the property in **Google Search Console**, submit
`/sitemap.xml`, and (optionally) run the page through Google's
[Rich Results Test](https://search.google.com/test/rich-results) to confirm the
SportsEvent markup is picked up.

---

## Project structure

```
app/
  layout.tsx              Root layout, fonts, full SEO metadata, analytics mounts
  page.tsx                SSR shell: loads fixtures, seeds <Fixtures>, emits JSON-LD
  globals.css             Styling (responsive dark theme)
  robots.ts               robots.txt (allows all, blocks /api, points to sitemap)
  sitemap.ts              sitemap.xml
  manifest.ts             PWA web manifest (/manifest.webmanifest)
  icon.svg                Favicon (soccer-ball badge)
  apple-icon.tsx          iOS home-screen icon (generated by next/og)
  opengraph-image.tsx     Social share card (generated by next/og)
  twitter-image.tsx       Re-exports the OG card for Twitter/X
  api/fixtures/route.ts   Thin proxy over lib/fixtures.ts (scores/schedule)
  api/match/[id]/route.ts Match detail: goals + cards (curated ▸ scraped)
components/
  Fixtures.tsx            Client UI: polling, tabs, live strip, event timeline, channel badges
lib/
  site.ts                 Central site config (URL, name, description, keywords)
  fixtures.ts             Shared fixtures loader + throttle cache (SSR + API route)
  jsonld.ts               Builds Schema.org SportsEvent / WebSite JSON-LD
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
2. Add env vars (see `.env.example`):
   - **`FOOTBALL_DATA_API_KEY`** — free key from
     [football-data.org](https://www.football-data.org/client/register). Without it
     the site serves clearly-labelled sample data.
   - **`NEXT_PUBLIC_SITE_URL`** — canonical origin for SEO (no trailing slash).
     Defaults to `https://worldup-fixtures.vercel.app`; set this when using a
     custom domain so canonical/OG/sitemap links are correct.
   - **`NEXT_PUBLIC_GA_ID`** *(optional)* — GA4 Measurement ID (`G-…`). GA only
     loads when set.
   - `COMPETITION` *(optional)* — defaults to `WC`.
3. **Enable Vercel Web Analytics + Speed Insights** in the project's *Analytics*
   tab (no code/env needed — the components are already mounted).
4. Deploy. The default branch is the production branch; pushes auto-redeploy.

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
8. **SEO overhaul.** The SPA was serving crawlers an empty body. Added server-side
   rendering of fixtures (shared throttle cache via `lib/fixtures.ts`), seeded the
   client component to kill the skeleton flash, and emitted **`SportsEvent` JSON-LD**
   for Google sports rich results. Added full metadata (`lib/site.ts`), OG/Twitter
   cards, a generated OG image, favicon/Apple icon, `robots.ts`, `sitemap.ts` and a
   web manifest. Timezone-dependent UI is gated behind mount to avoid hydration
   mismatches. See the [SEO & analytics](#seo--analytics) section.
9. **Analytics.** Wired both **Vercel Web Analytics + Speed Insights** (cookieless,
   privacy-friendly) and **GA4** via `@next/third-parties` (gated on
   `NEXT_PUBLIC_GA_ID`, for deeper analysis + Search Console).

---

## Roadmap (future features)

Benchmarked against BBC Sport, FlashScore, Sofascore, OneFootball and ESPN. Not
committed — a backlog of ideas and where they'd slot in.

### Big builds (heavy work, high payoff)

The large, multi-session features — ordered roughly by impact. Each notes the
*skill it exercises* (this project doubles as a learning vehicle: SEO that ranks,
analytics, ads, a11y).

- **Per-match pages** (`/match/[id]`, SSG/ISR via `generateStaticParams` +
  `generateMetadata`) — the biggest SEO multiplier. Each match becomes an
  indexable URL ("Brazil vs Morocco World Cup 2026") with its own title,
  description, per-match OG image, `SportsEvent` JSON-LD and internal links.
  Turns one page into 100+ long-tail landing pages. *(SEO that ranks; Next routing.)*
- **Editorial / programmatic SEO layer** — match previews & reports, "where to
  watch X", group/team guides. Content is what actually ranks for these queries;
  pair with a Search Console feedback loop. *(SEO content strategy + analytics.)*
- **Richer live data via API-Football (or football-data paid tier)** — real-time
  events, **live match minute/clock**, lineups, formations, stats (xG, shots,
  possession), head-to-head. The match route is already structured for events.
  *(API integration; removes the Wikipedia-lag limitation.)*
- **Group standings + knockout bracket** — compute W/D/L, GD, points from results;
  visual R32→final tree. Non-trivial data logic + UI. *(state modelling, data viz.)*
- **Team & player pages** — squads, scorer/assist/cards leaderboards, per-team
  fixtures. Another large SEO surface. *(data modelling + SEO.)*
- **Full WCAG 2.2 AA accessibility pass** — see the dedicated item below. *(directly
  relevant to his UK gov consultancy work.)*
- **Monetisation: Google AdSense/Ad Manager + a GDPR consent platform (CMP)** —
  ad slots, consent-gated analytics/ads, measuring revenue. *(Google Ads; consent/
  privacy engineering.)*
- **PWA offline + push notifications** — service worker caching last payload, Web
  Push for goals/kick-offs of favourite teams (needs a push backend). *(SW/push.)*
- **Favourites & personalisation** — "My teams" (localStorage → optional accounts);
  accounts pull in auth + a backend. *(auth/state; bigger if accounts are added.)*
- **i18n + multi-region channels** — translations and broadcaster maps beyond the
  UK (US/AU), per-region detection. Expands audience + SEO. *(i18n; content.)*

### High value / low effort
- **Group standings tables** — W/D/L, GD, points per group (compute from results).
- **Calendar export (.ics)** — "add this match/these fixtures to my calendar".
- **Knockout bracket view** — visual R32→final tree (placeholders until drawn).
- **Favourite teams** — pin teams (localStorage); a "My teams" tab like the England one.
- **Light/dark theme toggle** and a manual refresh button.
- **PWA / installable + offline** — ✅ web manifest added (installable / "add to
  home screen"); offline payload caching (service worker) still TODO.

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
- **Shareable match cards** (OG images) and deep links to a single match — ✅ a
  site-level OG share card is generated; per-match OG images + deep links still TODO.
- **Accessibility pass (WCAG 2.2 AA)** — keyboard nav + visible focus order, ARIA
  on the tabs (`tablist`/`tab`/`tabpanel`) and the live-score region (`aria-live`),
  ARIA on the event timeline, `prefers-reduced-motion` (kill the LIVE pulse),
  colour-contrast audit, and real screen-reader testing (VoiceOver/NVDA). Directly
  relevant to UK gov work — and a strong teaching candidate.
- **Analytics** (privacy-friendly) — ✅ done: Vercel Web Analytics + Speed Insights
  (cookieless) and GA4. Custom per-view/match event tracking is a possible next step.

### Data integrity
- **Replace curated channels/cards with an API** once a budget exists, keeping the
  curated files as fallback/override.
- **Scraper hardening** — handle knockout pages, more Wikipedia formatting variants,
  and surface a "last updated" indicator sourced from `data/events.json`.

---

*Data via [football-data.org](https://www.football-data.org/) and Wikipedia. UK TV
listings curated from published BBC/ITV schedules.*
