import type { Metadata } from "next";
import { loadFixtures } from "@/lib/fixtures";
import { computeStandings, fmtGD, groupLabel, type StandingRow } from "@/lib/standings";
import { SITE, absoluteUrl } from "@/lib/site";
import { slugify } from "@/lib/slug";

// Recompute at most every 30s; the table is derived from the same fixtures feed
// the homepage uses, so the CDN serves fresh, content-rich markup cheaply.
export const revalidate = 30;

const CANONICAL = "/groups";
const TITLE = "World Cup 2026 Group Standings — Tables, Points & Results";
const DESCRIPTION =
  "Live FIFA World Cup 2026 group tables: points, played, won, drawn, lost, " +
  "goals for and against, and goal difference for every group, updated as " +
  "results come in. Top two of each group plus the best third-placed teams " +
  "advance to the round of 32.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl(CANONICAL), type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

/** Qualification hint by finishing position (WC2026: top 2 + 8 best thirds advance). */
function qualClass(index: number): string {
  if (index < 2) return "q-auto"; // top two: through
  if (index === 2) return "q-third"; // third: best-thirds contention
  return "";
}

function TeamCell({ row }: { row: StandingRow }) {
  return (
    <span className="st-team">
      {row.team.crest ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="st-crest" src={row.team.crest} alt="" loading="lazy" />
      ) : (
        <span className="st-tla" aria-hidden="true">{row.tla}</span>
      )}
      <span className="st-name">{row.team.name}</span>
    </span>
  );
}

export default async function GroupsPage() {
  const { payload } = await loadFixtures();
  const tables = computeStandings(payload.matches);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "World Cup 2026", item: SITE.url },
      { "@type": "ListItem", position: 2, name: "Group standings", item: absoluteUrl(CANONICAL) },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="site-header">
        <div className="wrap">
          <a className="brand" href="/">
            <span className="brand-mark" aria-hidden="true">⚽</span>
            <div>
              <span className="brand-title">World Cup 2026</span>
              <span className="tagline">Live Fixtures &amp; Results</span>
            </div>
          </a>
        </div>
      </header>

      <main className="wrap groups-page">
        <nav className="crumbs" aria-label="Breadcrumb">
          <a href="/">World Cup 2026</a>
          <span aria-hidden="true"> › </span>
          <span aria-current="page">Group standings</span>
        </nav>

        <h1 className="groups-title">Group standings</h1>
        <p className="lead">
          Live <strong>FIFA World Cup 2026</strong> group tables — points, results and
          goal difference for all 12 groups, updated as matches finish. The top two of
          each group, plus the eight best third-placed teams, reach the round of 32.
        </p>

        {tables.length === 0 ? (
          <div className="state">
            <span className="emoji">📊</span>
            <h3>No group results yet</h3>
            <p>Tables will fill in as the group stage gets under way.</p>
          </div>
        ) : (
          <div className="groups-grid">
            {tables.map((t) => {
              const id = `g-${slugify(t.group)}`;
              return (
                <section className="standings" key={t.group} aria-labelledby={id}>
                  <h2 id={id} className="standings-head">{groupLabel(t.group)}</h2>
                  <div className="table-scroll">
                    <table className="standings-table">
                      <thead>
                        <tr>
                          <th scope="col" className="c-pos">#</th>
                          <th scope="col" className="c-team">Team</th>
                          <th scope="col"><abbr title="Played">P</abbr></th>
                          <th scope="col"><abbr title="Won">W</abbr></th>
                          <th scope="col"><abbr title="Drawn">D</abbr></th>
                          <th scope="col"><abbr title="Lost">L</abbr></th>
                          <th scope="col" className="c-opt"><abbr title="Goals for">GF</abbr></th>
                          <th scope="col" className="c-opt"><abbr title="Goals against">GA</abbr></th>
                          <th scope="col"><abbr title="Goal difference">GD</abbr></th>
                          <th scope="col" className="c-pts"><abbr title="Points">Pts</abbr></th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.rows.map((r, i) => (
                          <tr key={r.tla} className={qualClass(i)}>
                            <td className="c-pos">{i + 1}</td>
                            <td className="c-team"><TeamCell row={r} /></td>
                            <td>{r.played}</td>
                            <td>{r.won}</td>
                            <td>{r.drawn}</td>
                            <td>{r.lost}</td>
                            <td className="c-opt">{r.goalsFor}</td>
                            <td className="c-opt">{r.goalsAgainst}</td>
                            <td>{fmtGD(r.goalDifference)}</td>
                            <td className="c-pts">{r.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <p className="groups-legend">
          <span className="key q-auto" aria-hidden="true" /> Top two — through ·{" "}
          <span className="key q-third" aria-hidden="true" /> Third — best-thirds contention
        </p>

        <p className="md-back">
          <a href="/">← All fixtures &amp; results</a>
        </p>
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <p>
            Standings computed from results via{" "}
            <a href="https://www.football-data.org/" rel="noopener" target="_blank">
              football-data.org
            </a>
            . Tie-breaks: points, then goal difference, then goals scored.
          </p>
        </div>
      </footer>
    </>
  );
}
