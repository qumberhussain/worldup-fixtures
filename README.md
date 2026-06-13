# World Cup 2026 — Live Fixtures &amp; Results

A Next.js app showing **live in-play scores**, **upcoming matches**, and **results**
for the FIFA World Cup 2026. The page polls a server-side API route every 15s, so
scores update without a manual refresh — and the football-data.org API key never
reaches the browser.

## How it works

```
Browser ──poll every 15s──▶  /api/fixtures (Next.js server route)
                                   │ holds API key, adds caching
                                   ▼
                          football-data.org  (live World Cup feed)
```

- **`app/api/fixtures/route.ts`** runs on the server. It reads `FOOTBALL_DATA_API_KEY`
  from the environment, calls football-data.org, normalizes the response, and
  caches the upstream call for ~15s so many visitors don't blow the rate limit.
- **`components/Fixtures.tsx`** is a client component that polls `/api/fixtures`
  every 15s (pausing when the tab is hidden), shows a "Live · updated Ns ago"
  indicator, a live-match strip, and groups matches by day.
- **Upcoming vs played** is decided per match from its `status`
  (`IN_PLAY`/`PAUSED` → live, `FINISHED` → result, else → upcoming), with a
  kickoff-time fallback.
- If no API key is set, the route serves clearly-labeled **sample data** so the
  page always renders.

> **Note on "live":** the plumbing here is real-time (15s polling, key hidden).
> The actual freshness is capped by your data plan — football-data.org's *free*
> tier delays in-match updates. For second-by-second scores, swap in a paid/live
> feed; no code changes beyond the API route are needed.

## Deploy on Vercel

Next.js server routes need a Node runtime, so this deploys on Vercel (not static
GitHub Pages).

1. Go to [vercel.com/new](https://vercel.com/new) and **import** `worldup-fixtures`.
   Vercel auto-detects Next.js — no build config needed.
2. Add an environment variable: **`FOOTBALL_DATA_API_KEY`** = your free key from
   [football-data.org/client/register](https://www.football-data.org/client/register).
   (Optional: `COMPETITION`, defaults to `WC`.)
3. **Deploy.** Every push to the branch creates a new deployment.

Without the env var, the live site still works on sample data.

## Local development

```bash
npm install
npm run dev          # http://localhost:3000

# with live data:
FOOTBALL_DATA_API_KEY=yourkey npm run dev
```

## Project layout

| Path | Purpose |
|------|---------|
| `app/page.tsx` | Page shell (server component) |
| `app/layout.tsx` | Root layout, fonts, metadata |
| `app/globals.css` | Styling (responsive, dark theme) |
| `app/api/fixtures/route.ts` | Server proxy: holds key, fetches & caches live data |
| `components/Fixtures.tsx` | Client UI: polling, tabs, live strip, rendering |
| `lib/normalize.ts` | football-data.org → app shape + match classification |
| `lib/sample.ts` | Sample fallback data |
| `lib/types.ts` | Shared types |
