import type { Match } from "./types";

/**
 * URL slugs for per-match pages. Shape: `home-vs-away-<id>`, e.g.
 * `brazil-vs-morocco-535123`. The numeric id is the source of truth (parsed off
 * the end); the team names are there purely for SEO/readability, so if teams
 * change (TBD → drawn) the page canonical-redirects to the fresh slug.
 */
export function slugify(input: string): string {
  return (
    input
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // strip diacritics (Türkiye → turkiye)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "tbd"
  );
}

export function matchSlug(m: Match): string {
  const home = slugify(m.homeTeam?.name || "tbd");
  const away = slugify(m.awayTeam?.name || "tbd");
  return `${home}-vs-${away}-${m.id}`;
}

/** Extract the match id from a slug (trailing number), or a bare numeric slug. */
export function parseMatchId(slug: string): number | null {
  const m = slug.match(/-(\d+)$/) || slug.match(/^(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}
