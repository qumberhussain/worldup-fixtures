"use strict";

const DATA_URL = "./data/fixtures.json";
// football-data.org statuses we treat as "currently being played"
const LIVE_STATUSES = new Set(["IN_PLAY", "PAUSED"]);
const FINISHED_STATUSES = new Set(["FINISHED", "AWARDED"]);

const state = {
  matches: [],
  view: "upcoming", // upcoming | results | all
  query: "",
  meta: {},
};

const els = {
  content: document.getElementById("content"),
  skeleton: document.getElementById("skeleton"),
  tabs: document.getElementById("tabs"),
  search: document.getElementById("search"),
  liveStrip: document.getElementById("liveStrip"),
  updated: document.getElementById("updated"),
  sourceDot: document.getElementById("sourceDot"),
};

init();

async function init() {
  wireControls();
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.matches = Array.isArray(data.matches) ? data.matches : [];
    state.meta = data;
    renderMeta(data);
    renderLiveStrip();
    render();
  } catch (err) {
    showError(err);
  }
}

function wireControls() {
  els.tabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    state.view = btn.dataset.view;
    [...els.tabs.children].forEach((t) => {
      const active = t === btn;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", String(active));
    });
    render();
  });

  let t;
  els.search.addEventListener("input", (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.query = e.target.value.trim().toLowerCase();
      render();
    }, 120);
  });
}

/* ---------- classification ---------- */

function classify(m) {
  if (LIVE_STATUSES.has(m.status)) return "live";
  if (FINISHED_STATUSES.has(m.status)) return "played";
  // Fall back to date for anything ambiguous (SCHEDULED/TIMED, or missing status)
  const kicked = new Date(m.utcDate).getTime();
  if (Number.isFinite(kicked) && kicked < Date.now() && hasScore(m)) return "played";
  return "upcoming";
}

function hasScore(m) {
  return m.score && m.score.home != null && m.score.away != null;
}

function matchesQuery(m) {
  if (!state.query) return true;
  const hay = [
    m.homeTeam?.name, m.awayTeam?.name,
    m.homeTeam?.tla, m.awayTeam?.tla,
    m.group, m.venue, m.stage,
  ].filter(Boolean).join(" ").toLowerCase();
  return hay.includes(state.query);
}

/* ---------- rendering ---------- */

function renderMeta(data) {
  const isLive = data.source && data.source !== "sample";
  els.sourceDot.classList.toggle("live-source", isLive);
  els.sourceDot.classList.toggle("sample-source", !isLive);
  els.sourceDot.title = isLive ? `Live data (${data.source})` : "Sample data";

  const label = isLive ? "Updated" : "Sample data";
  if (data.lastUpdated) {
    const d = new Date(data.lastUpdated);
    els.updated.textContent = `${label} · ${d.toLocaleString([], {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    })}`;
  } else {
    els.updated.textContent = label;
  }
}

function renderLiveStrip() {
  const live = state.matches.filter((m) => classify(m) === "live");
  if (!live.length) {
    els.liveStrip.hidden = true;
    els.liveStrip.innerHTML = "";
    return;
  }
  els.liveStrip.hidden = false;
  els.liveStrip.innerHTML = live.map((m) => `
    <div class="live-chip">
      <span class="live-tag">LIVE</span>
      <div class="lc-teams">
        ${esc(m.homeTeam?.tla || m.homeTeam?.name)}
        <span class="lc-score">${m.score?.home ?? 0}–${m.score?.away ?? 0}</span>
        ${esc(m.awayTeam?.tla || m.awayTeam?.name)}
      </div>
    </div>`).join("");
}

function render() {
  if (els.skeleton) { els.skeleton.remove(); els.skeleton = null; }

  let list = state.matches.filter(matchesQuery);
  const bucket = (m) => classify(m);

  if (state.view === "upcoming") {
    list = list.filter((m) => bucket(m) !== "played");
    list.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
  } else if (state.view === "results") {
    list = list.filter((m) => bucket(m) === "played");
    list.sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate));
  } else {
    list.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
  }

  if (!list.length) {
    els.content.innerHTML = emptyState();
    return;
  }

  // group by calendar day (local)
  const groups = new Map();
  for (const m of list) {
    const key = dayKey(m.utcDate);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }

  const html = [...groups.entries()].map(([key, items]) => `
    <div class="day-group">
      <div class="day-head">
        <h2>${esc(dayLabel(key))}</h2>
        <span class="day-sub">${items.length} match${items.length > 1 ? "es" : ""}</span>
      </div>
      ${items.map(matchCard).join("")}
    </div>`).join("");

  els.content.innerHTML = html;
}

function matchCard(m) {
  const kind = classify(m);
  const played = kind === "played";
  const live = kind === "live";
  const h = m.homeTeam || {}, a = m.awayTeam || {};

  const homeWin = played && hasScore(m) && m.score.home > m.score.away;
  const awayWin = played && hasScore(m) && m.score.away > m.score.home;

  let center;
  if (played || live) {
    const hs = m.score?.home ?? 0, as = m.score?.away ?? 0;
    const badge = live
      ? `<span class="badge live">● Live</span>`
      : `<span class="badge ft">Full time</span>`;
    center = `<div class="score">${hs}<span class="dash">–</span>${as}</div>${badge}`;
  } else {
    center = `<div class="kickoff">${kickoffTime(m.utcDate)}</div>
              <span class="badge upcoming">Upcoming</span>`;
  }

  const meta = [
    m.group ? `<span>🏆 ${esc(m.group)}</span>` : "",
    m.stage && m.stage !== "GROUP_STAGE" ? `<span>${esc(prettyStage(m.stage))}</span>` : "",
    m.venue ? `<span>📍 ${esc(m.venue)}</span>` : "",
  ].filter(Boolean).join("");

  return `
    <article class="match ${live ? "is-live" : ""}">
      <div class="team home ${homeWin ? "winner" : ""}">
        <span class="name">${esc(h.name || "TBD")}</span>
        ${teamMark(h)}
      </div>
      <div class="center">${center}</div>
      <div class="team away ${awayWin ? "winner" : ""}">
        ${teamMark(a)}
        <span class="name">${esc(a.name || "TBD")}</span>
      </div>
      ${meta ? `<div class="match-meta">${meta}</div>` : ""}
    </article>`;
}

function teamMark(t) {
  if (t.crest) return `<img class="crest" src="${esc(t.crest)}" alt="" loading="lazy" />`;
  return `<span class="tla">${esc(t.tla || (t.name ? t.name.slice(0, 3).toUpperCase() : "—"))}</span>`;
}

/* ---------- states ---------- */

function emptyState() {
  const map = {
    upcoming: ["📅", "No upcoming matches", "Check the Results tab or try a different filter."],
    results: ["⚽", "No results yet", "Played matches will appear here once games kick off."],
    all: ["🔍", "Nothing to show", "Try clearing your filter."],
  };
  const [emoji, title, sub] = map[state.view] || map.all;
  return `<div class="state"><span class="emoji">${emoji}</span><h3>${title}</h3><p>${sub}</p></div>`;
}

function showError(err) {
  if (els.skeleton) { els.skeleton.remove(); els.skeleton = null; }
  els.content.innerHTML = `
    <div class="state">
      <span class="emoji">⚠️</span>
      <h3>Couldn't load fixtures</h3>
      <p>${esc(String(err.message || err))}</p>
    </div>`;
  els.updated.textContent = "Error";
}

/* ---------- helpers ---------- */

function dayKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function dayLabel(key) {
  const [y, mo, da] = key.split("-").map(Number);
  const d = new Date(y, mo, da);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  const rel = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : null;
  const full = d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  return rel ? `${rel} · ${full}` : full;
}
function kickoffTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function prettyStage(s) {
  return String(s).replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
