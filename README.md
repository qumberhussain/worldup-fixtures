# World Cup 2026 — Fixtures &amp; Results

A static webpage that shows **upcoming matches** and **played results** for the
FIFA World Cup 2026, deployed on GitHub Pages. Data is pulled from
[football-data.org](https://www.football-data.org/) on a schedule.

## How it works

```
football-data.org  ──(GitHub Action, every 20 min)──▶  data/fixtures.json  ──▶  static site
```

- A scheduled **GitHub Action** (`.github/workflows/update-data.yml`) runs
  `scripts/fetch-fixtures.mjs` server-side using a secret API key, normalizes the
  response, and commits `data/fixtures.json`.
- The static page (`index.html` + `assets/`) reads that JSON in the browser.
  No API key is ever exposed, and there are no CORS issues.
- **Upcoming vs played** is decided per match: `IN_PLAY`/`PAUSED` → live,
  `FINISHED` → result shown, everything else → upcoming. The page also
  falls back to the kickoff time if a status is missing.

## One-time setup

1. **Add the API key as a secret**
   - Get a free key at <https://www.football-data.org/client/register>.
   - Repo → **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `FOOTBALL_DATA_API_KEY` — Value: your key.

2. **Enable GitHub Pages**
   - Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.

3. **Populate live data**
   - Merge this branch to your default branch (scheduled Actions only run from
     the default branch), then run the **Update fixtures data** workflow once via
     **Actions → Update fixtures data → Run workflow**.
   - The **Deploy to GitHub Pages** workflow publishes the site on every push.

Until step 3 runs, the site renders the sample data in `data/fixtures.json` so
you can preview the layout.

## Local development

```bash
# Preview the static site
python3 -m http.server 8000     # then open http://localhost:8000

# Refresh data locally (needs a key)
FOOTBALL_DATA_API_KEY=yourkey node scripts/fetch-fixtures.mjs
```

## Project layout

| Path | Purpose |
|------|---------|
| `index.html` | Page shell |
| `assets/styles.css` | Styling (responsive, dark theme) |
| `assets/app.js` | Fetches JSON, classifies & renders matches |
| `data/fixtures.json` | Normalized match data (sample → live) |
| `scripts/fetch-fixtures.mjs` | Pulls & normalizes data from football-data.org |
| `.github/workflows/` | Scheduled data refresh + Pages deploy |
