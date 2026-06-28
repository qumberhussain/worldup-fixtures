# PLAN.md — active work tracker & backlog

> **Future Claude / future me: start here.** This file is the living tracker for
> in-progress work. [`README.md`](./README.md) is the full project log / decision
> record (the *why* behind everything shipped). This file is the *what's-next*:
> goals, current feature spec, task status, and backlog. Keep it updated as work
> moves — it's how a fresh session (post context-clear) rebuilds the picture from
> the repo alone.

**Status legend:** ✅ done · 🔨 in progress · ⏳ todo · 🅿️ parked (later)
**Owner tags:** `[human]` qumber hand-writes the code · `[claude]` Claude does it · `[pair]` together

---

## How we're working (read before touching code)

This feature is being built in **pairing / teaching mode** (see user memory
`working-mode`): **qumber hand-writes the app code** (types, loaders, routes,
components) as a deliberate learning exercise; **Claude gathers raw data and
guides/reviews** rather than writing the app code for him.

→ **Do not write the app-layer code for him unless he explicitly asks.** Gather
data, scaffold non-learning grunt work (scrapers), explain trade-offs, review
what he writes, suggest the next step. Default project mode is build-fast/flow;
this teaching split applies to the team-pages feature.

---

## CURRENT FEATURE: Team / Squad pages

### Goal
A page per national team (48 teams) plus a teams index, covering:
- **Squad grouped by position** (Goalkeepers / Defenders / Midfielders / Forwards)
- **Starting XI + bench** overlay (see data note below — editorial now, real later)
- **Team meta:** crest, group, head coach
- **The team's fixtures & results**, pulled from the existing fixtures feed
- Full SEO parity with match pages (sitemap, JSON-LD, canonical, OG)

### Architecture decisions (locked)
- **Keyed by FIFA code (TLA)** — `ENG`, `BRA`, … — like everything else
  (`channels`, `events`). Name→code via `NAME_TO_TLA` in `lib/channels.ts`.
- **Types describe OUR domain, not any source's wire format.** Each data source
  normalizes *into* `Player` / `Squad`. The loader picks the source via a
  precedence chain. This is the exact pattern already used by
  `lib/match-events.ts` (curated/scraped → paid API behind `FOOTBALL_DATA_PAID`)
  and `lib/normalize.ts` (raw → domain). Mirror it.
- **Routing mirrors `app/match/[slug]`**: `app/team/[slug]` with a readable slug
  (e.g. `england-eng`), id/code parsed off the slug, canonical-redirect on drift,
  plus `not-found`. Slug helpers live in `lib/slug.ts`.

### Data source: scraped now, paid swap later
- **NOW (free):** squads scraped from Wikipedia → `data/squads.json` via
  `scripts/scrape-squads.mjs`. ✅ done. Re-run with `node scripts/scrape-squads.mjs`.
- **LATER (paid):** football-data.org **€29/mo** plan includes *Live scores,
  Fixtures, League Tables, **Line-ups & Subs**, Goal scorers, Bookings/Cards,
  Squads, 30 calls/min*. Plan: subscribe during the tournament, persist the data
  in-repo, **cancel after** (data is static post-event).
  - Squads: already free → paid squad endpoint is redundant.
  - **Line-ups & Subs**: the real source for the starting-XI/bench overlay
    (no free equivalent). Populate `starter` from the most-recent match line-up
    rather than hand-curating.
  - Swap mechanism: add a normalizer that emits `Player`/`Squad`; gate it behind
    `FOOTBALL_DATA_PAID`; loader precedence picks it. Route/UI never change.
  - Plumbing note (🅿️): paid squad/lineup endpoints key on football-data numeric
    team IDs (we key on TLA) — map via `/competitions/WC/teams` when needed.

### Data contract — `data/squads.json` (✅ built: 48 teams, 1248 players)
```jsonc
{
  "source": "wikipedia", "scrapedAt": "<ISO>", "teamCount": 48,
  "teams": {
    "ENG": {
      "name": "England", "code": "ENG", "group": "Group L", "coach": "Thomas Tuchel",
      "players": [
        { "no": 9, "pos": "FW", "name": "Harry Kane", "dob": "1993-07-28",
          "caps": 114, "goals": 79, "club": "Bayern Munich", "clubNat": "GER", "captain": true }
        // …26 per team
      ]
    }
    // …48 teams keyed by TLA
  }
}
```
`pos` is raw `"GK" | "DF" | "MF" | "FW"`. No `starter` field in the data — that
overlay is added in the type as optional and filled editorially / from paid
line-ups later.

### Task checklist
1. ✅ `[claude]` Gather data → `scripts/scrape-squads.mjs` + `data/squads.json`
2. 🔨 `[human]` **Types** in `lib/types.ts`: `Player`, `Squad`, `SquadsFile`
   - `pos` as narrow union; position display labels derived in the UI
   - `starter?: boolean` **optional** (neither source sets it today)
   - keep source-agnostic so the paid normalizer slots in unchanged
   - ← **CURRENT "your move" step**
3. ⏳ `[human]` `lib/squads.ts` loader: `getSquad(code)`, `getAllTeams()`; read
   `data/squads.json`; mirror `lib/events.ts` (precedence-ready for paid later)
4. ⏳ `[human]` `app/team/[slug]/page.tsx` + `not-found.tsx` + canonical redirect
   (mirror `app/match/[slug]`)
5. ⏳ `[human]` `app/teams/page.tsx` — index grouped A–L, linking each team
6. ⏳ `[human]` Squad UI components: group-by-position view + XI/bench view
7. ⏳ `[pair]` SEO: `app/sitemap.ts` entries, JSON-LD (`SportsTeam`) in `lib/jsonld.ts`,
   page metadata, links from match pages + homepage to team pages
8. ⏳ `[pair]` Wire `scrape-squads.mjs` into a GitHub Action (low cadence — squads
   are static; daily at most), or leave as manual run
9. 🅿️ `[claude]` Paid football-data normalizer (squads + line-ups) behind
   `FOOTBALL_DATA_PAID`; team-id map via `/competitions/WC/teams`

### Conventions to follow
- Data-gap pattern (no free API): curate/scrape → JSON → precedence loader.
  References: `lib/events.ts`, `lib/channels.ts`, `lib/match-events.ts`.
- Raw→domain normalization: `lib/normalize.ts`.
- SEO single source of truth: `lib/site.ts`; consumers `sitemap.ts`, `robots.ts`,
  `lib/jsonld.ts`, `app/layout.tsx`.
- Slugs: `lib/slug.ts` (`slugify`, parse trailing id/code).

---

## Recently done (context for cold starts)
- ✅ **Group standings pages** — `lib/standings.ts` (`computeStandings`, pure;
  derives W/D/L/GF/GA/GD/Pts per group from played matches, seeds unplayed teams
  at zero) + `app/groups/page.tsx` (12 tables, ISR 30s, metadata + breadcrumb
  JSON-LD, qualification accents). Linked from the homepage header/footer + each
  match page, and added to the sitemap. Tie-break = Pts → GD → GF → name (full
  FIFA head-to-head / fair-play is a deliberate v1 omission — see backlog).
- ✅ **Events red-card bug fixed** — the scraper was recording 3 phantom reds per
  finished group (a fake "third-place ranking" player at 0/1/2'). Cause: the
  single-param `{{sent off|0|1|2}}` legend in each group's disciplinary/fair-play
  ranking table bled into the last match's block. Fix in `scripts/scrape-events.mjs`:
  only accept the real two-param `{{sent off|<yellows>|<minute>}}` form. Verified
  0 bogus / 7 real reds kept; left `data/events.json` for the cron to regenerate.
- ✅ Squad data scraped → `data/squads.json` + `scripts/scrape-squads.mjs`.
- ✅ Fixed canonical site URL fallback → `worldcup2026-fixtures.vercel.app`
  (was the `worldup-fixtures` typo; the un-typo'd name was taken on Vercel).
  Lives in `lib/site.ts`, `.env.example`, `README.md`.

## Backlog / ideas (not yet scheduled)
- **Standings: full FIFA tie-breakers** — `computeStandings` currently sorts by
  Pts → GD → GF → name. Add head-to-head (mini-table among exactly-level teams),
  then fair-play points, then drawing of lots. Needs care: a pairwise comparator
  is non-transitive for 3-way ties, so resolve tied clusters as a mini-league.
- **Best-third-placed table** — the page flags 3rd places (amber) but doesn't yet
  rank the 12 thirds to show which 8 qualify. Compute once H2H lands.
- Player detail pages (per player) once squad data is live.
- Real per-match line-ups on the match pages (paid Line-ups & Subs feed).
- Revisit `UPSTREAM_TTL` throttle in `lib/fixtures.ts` if on the 30-calls/min tier.
- See README **Roadmap** section for the broader feature backlog.
