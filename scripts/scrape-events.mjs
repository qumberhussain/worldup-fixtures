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
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "data", "events.json");
const GROUPS = "ABCDEFGHIJKL".split("");
const API = "https://en.wikipedia.org/w/api.php";

async function fetchWikitext(group) {
  const page = `2026_FIFA_World_Cup_Group_${group}`;
  const url = `${API}?action=parse&page=${page}&prop=wikitext&format=json&formatversion=2`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "worldup-fixtures/1.0 (events scraper)" } });
    if (res.status === 429) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`${page}: HTTP ${res.status}`);
    const json = await res.json();
    return json.parse?.wikitext || "";
  }
  throw new Error(`${page}: HTTP 429 (after retries)`);
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
      entries = tmpl.map((g) => {
        const params = g[2].split("|").map((s) => s.trim());
        const pen = g[1].toLowerCase() === "pgoal" || params.slice(1).some((p) => /pen/i.test(p));
        return { spec: params[0], pen };
      });
    } else {
      const penChunk = /pen/i.test(chunk);
      entries = [...chunk.matchAll(/(\d{1,3}(?:\+\d{1,2})?)\s*['′]/g)].map((mm) => ({
        spec: mm[1],
        pen: penChunk,
      }));
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

async function main() {
  const all = {};
  for (const g of GROUPS) {
    try {
      const wt = await fetchWikitext(g);
      const parsed = parsePage(wt);
      Object.assign(all, parsed);
      process.stderr.write(`Group ${g}: ${Object.keys(parsed).length} match(es) with goals\n`);
    } catch (err) {
      process.stderr.write(`Group ${g}: skipped (${err.message})\n`);
    }
    await sleep(700); // be polite to the Wikipedia API (avoid 429)
  }
  const payload = {
    source: "wikipedia",
    scrapedAt: new Date().toISOString(),
    matches: all,
  };
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");
  process.stderr.write(`\nWrote ${Object.keys(all).length} matches to data/events.json\n`);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
