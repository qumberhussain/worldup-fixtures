#!/usr/bin/env node
/**
 * Scrapes goal scorers for completed World Cup 2026 matches from Wikipedia's
 * group-stage pages and writes data/events.json (keyed by FIFA team-code pair).
 *
 * Why Wikipedia: football-data.org's free tier returns no match events. The
 * group pages encode goals cleanly in each match's `goals1`/`goals2` fields
 * with FIFA team codes, so goals are reliable to parse. CARDS are intentionally
 * NOT scraped — in the wikitext they live in the lineup section with mixed
 * teams and noisy player links, so they can't be attributed reliably. Cards are
 * maintained by hand in lib/events.ts, which overrides this file per match.
 *
 * Run: node scripts/scrape-events.mjs   (no API key needed)
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "data", "events.json");
const GROUPS = "ABCDEFGHIJKL".split("");
const API = "https://en.wikipedia.org/w/api.php";

/**
 * Fetch the wikitext of every group page in ONE request via the MediaWiki
 * `query` API (up to 50 titles per call). The old approach made 12 separate
 * `parse` requests; the last couple (Groups K, L) were reliably 429'd once the
 * IP had fired ~10 rapid requests, so those groups never refreshed and their
 * matches stayed blank on the site. A single batched request sidesteps the
 * per-request rate limit entirely. Returns a { [group letter]: wikitext } map.
 */
async function fetchAllWikitext(groups) {
  const titles = groups.map((g) => `2026_FIFA_World_Cup_Group_${g}`).join("|");
  const url =
    `${API}?action=query&prop=revisions&rvprop=content&rvslots=main` +
    `&titles=${encodeURIComponent(titles)}&format=json&formatversion=2`;
  let lastErr = "unknown";
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "worldup-fixtures/1.0 (events scraper)" } });
    if (res.status === 429) {
      lastErr = "HTTP 429";
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`group pages: HTTP ${res.status}`);
    const json = await res.json();
    const pages = json.query?.pages || [];
    const byGroup = {};
    for (const p of pages) {
      const letter = p.title?.match(/Group ([A-L])$/)?.[1];
      const content = p.revisions?.[0]?.slots?.main?.content;
      if (letter && content) byGroup[letter] = content;
    }
    return byGroup;
  }
  throw new Error(`group pages: ${lastErr} (after retries)`);
}

function cleanName(raw) {
  // "Teboho Mokoena (soccer, born 1997)" -> "Teboho Mokoena"
  return raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function parseGoals(block, teamCode) {
  const goals = [];
  // Match each player link and the text after it (up to the next link), which
  // holds that player's {{goal}} templates. Works whether or not the entry is
  // bulleted (single-goal entries on Wikipedia often omit the leading "*").
  const re = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]([\s\S]*?)(?=\[\[|$)/g;
  let m;
  while ((m = re.exec(block))) {
    const target = m[1];
    if (/^(Captain|Penalty|Own goal)/i.test(target)) continue; // not a scorer link
    const scorer = cleanName(m[2] || m[1]);
    const chunk = m[3] || "";
    const isOwn = /own[\s_]?goal|\bo\.?g\.?\b/i.test(chunk);

    // Two Wikipedia styles: {{goal|78}} templates, or plain text like "78'".
    const tmpl = [...chunk.matchAll(/\{\{\s*(p?goal)\s*\|([^}]+)\}\}/gi)];
    let entries;
    if (tmpl.length) {
      // Every template param is its own goal minute — a brace is one template
      // with multiple params (e.g. {{goal|31|45+5}}), so map ALL of them, not
      // just the first. A param may annotate a penalty inline ("45 (pen.)"),
      // and {{pgoal|...}} marks every minute a penalty.
      entries = tmpl.flatMap((g) => {
        const allPen = g[1].toLowerCase() === "pgoal";
        return g[2]
          .split("|")
          .map((p) => p.trim())
          .map((p) => {
            const min = p.match(/\d{1,3}(?:\+\d{1,2})?/);
            return min ? { spec: min[0], pen: allPen || /pen/i.test(p) } : null;
          })
          .filter(Boolean);
      });
    } else {
      const penChunk = /pen/i.test(chunk);
      // Within a goals chunk (text after a scorer link, up to the next link)
      // every standalone number is a goal minute. Editors are inconsistent:
      // some write "20'" / "45+5'" with a trailing apostrophe, others write the
      // bare minute ("16") or a comma list ("29, 45+3, 90+2"). Earlier this
      // regex required an apostrophe or a pen/o.g. marker, so bare-minute goals
      // were silently dropped (only own goals/penalties survived). Match any
      // minute (optionally +stoppage), bounded so a longer digit run (e.g. a
      // stray "2026") can't be split into bogus minutes.
      entries = [
        ...chunk.matchAll(/(?<![\d+])(\d{1,3}(?:\+\d{1,2})?)(?!\d)/g),
      ].map((mm) => ({ spec: mm[1], pen: penChunk }));
    }

    for (const e of entries) {
      const [min, inj] = e.spec.split("+").map((x) => parseInt(x, 10));
      if (!Number.isFinite(min)) continue;
      goals.push({
        minute: min,
        ...(inj ? { injuryTime: inj } : {}),
        team: teamCode,
        scorer,
        ...(isOwn ? { type: "OWN" } : e.pen ? { type: "PENALTY" } : {}),
      });
    }
  }
  return goals;
}

function parseCards(region, team) {
  const out = [];
  const seen = new Set();
  let lastPlayer = null;
  const re = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]([\s\S]*?)(?=\[\[|$)/g;
  let m;
  while ((m = re.exec(region))) {
    const target = m[1];
    // The captain "(c)" link and similar sit between a player and their card;
    // keep the last real player so the card still attributes correctly.
    if (!/^(Captain|Penalty|Own goal|Yellow card|Red card|Substitut)/i.test(target)) {
      lastPlayer = cleanName(m[2] || m[1]);
    }
    if (!lastPlayer) continue;
    const chunk = m[3] || "";
    const push = (spec, type) => {
      const [min, inj] = String(spec).split("+").map((x) => parseInt(x, 10));
      if (!Number.isFinite(min)) return;
      const key = `${lastPlayer}|${min}|${inj || 0}|${type}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ minute: min, ...(inj ? { injuryTime: inj } : {}), team, player: lastPlayer, type });
    };
    for (const y of chunk.matchAll(/\{\{\s*yel\s*\|\s*(\d{1,3}(?:\+\d{1,2})?)/gi)) push(y[1], "YELLOW");
    for (const so of chunk.matchAll(/\{\{\s*sent off\s*\|([^}]*)\}\}/gi)) {
      const params = so[1].split("|").map((s) => s.trim());
      push(params.length > 1 ? params[1] : params[0], "RED"); // red minute
    }
  }
  return out;
}

function parsePage(wt) {
  const out = {};
  // Each detailed match box starts with team1's fb-rt flag invoke; a match's
  // block runs until the next box (so it includes the lineup with cards).
  const startRe = /team1=\{\{#invoke:flag\|fb-rt\|([A-Z]{3})\}\}/g;
  const starts = [];
  let m;
  while ((m = startRe.exec(wt))) starts.push({ idx: m.index, t1: m[1] });

  for (let i = 0; i < starts.length; i++) {
    const block = wt.slice(starts[i].idx, starts[i + 1]?.idx);
    const t1 = starts[i].t1;
    const t2m = block.match(/team2=\{\{#invoke:flag\|fb\|([A-Z]{3})\}\}/);
    if (!t2m) continue;
    const t2 = t2m[1];

    // Goals: between team2 and |stadium= , split on |goals2=.
    const afterT2 = block.slice(block.indexOf(t2m[0]) + t2m[0].length);
    const goalsRegion = afterT2.slice(0, afterT2.indexOf("|stadium="));
    const g2 = goalsRegion.indexOf("|goals2=");
    let goals = [];
    if (g2 >= 0) {
      const goals1 = goalsRegion.slice(0, g2).replace(/^[\s\S]*?\|goals1=/, "");
      const goals2 = goalsRegion.slice(g2 + "|goals2=".length);
      goals = [...parseGoals(goals1, t1), ...parseGoals(goals2, t2)];
    }

    // Cards: the lineups are a 2-column table (team1 | team2). Split on the
    // valign="top" column cells; col 1 = team1, the rest = team2.
    const cols = block.split(/\|\s*valign\s*=\s*"top"/i);
    let cards = [];
    if (cols.length >= 3) {
      cards = [...parseCards(cols[1], t1), ...parseCards(cols.slice(2).join(" "), t2)];
    }

    if (goals.length || cards.length) {
      out[`${t1}|${t2}`] = { goals, ...(cards.length ? { cards } : {}) };
    }
  }
  return out;
}

/** Load the previously-scraped matches so a failed group doesn't blank them. */
async function loadPrevious() {
  try {
    const prev = JSON.parse(await readFile(OUT, "utf8"));
    return prev?.matches && typeof prev.matches === "object" ? prev.matches : {};
  } catch {
    return {}; // first run / unreadable file
  }
}

async function main() {
  // Start from the last-good data and overlay only the groups we fetch
  // successfully. A single group can transiently 429 (shared CI egress IPs);
  // rebuilding from scratch each run meant any skipped group's matches were
  // dropped from the committed file, blanking them on the live site until a
  // later run happened to succeed. Merging makes a skip non-destructive — the
  // group keeps its previous events and self-heals on the next good fetch.
  const all = await loadPrevious();
  let pages;
  try {
    pages = await fetchAllWikitext(GROUPS);
  } catch (err) {
    // Fetch failed outright — leave the committed file untouched and exit red
    // so the previous good data keeps serving rather than being overwritten.
    process.stderr.write(`\nFetch failed (${err.message}) — leaving data/events.json unchanged.\n`);
    process.exit(1);
  }
  let ok = 0;
  for (const g of GROUPS) {
    const wt = pages[g];
    if (!wt) {
      process.stderr.write(`Group ${g}: missing from response, keeping previous\n`);
      continue;
    }
    const parsed = parsePage(wt);
    Object.assign(all, parsed);
    ok++;
    process.stderr.write(`Group ${g}: ${Object.keys(parsed).length} match(es) with goals\n`);
  }
  const payload = {
    source: "wikipedia",
    scrapedAt: new Date().toISOString(),
    matches: all,
  };
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");
  process.stderr.write(`\nWrote ${Object.keys(all).length} matches (${ok}/${GROUPS.length} groups fetched) to data/events.json\n`);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
