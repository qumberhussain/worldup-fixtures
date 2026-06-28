import Fixtures from "@/components/Fixtures";
import { loadFixtures } from "@/lib/fixtures";
import { buildHomeJsonLd } from "@/lib/jsonld";

// Re-render the HTML at most every 30s. The CDN serves crawlers (and users)
// fresh, content-rich markup, while the client component keeps polling for
// true live updates on top of this baseline.
export const revalidate = 30;

export default async function Home() {
  const { payload } = await loadFixtures();
  const jsonLd = buildHomeJsonLd(payload.matches);

  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify output is safe to inline; no user input is interpolated.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="site-header">
        <div className="wrap">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">⚽</span>
            <div>
              <h1>World Cup 2026 — Live Scores &amp; Fixtures</h1>
              <p className="tagline">Results, goal scorers &amp; the UK TV channel for every match</p>
            </div>
          </div>
          <nav className="site-nav" aria-label="Primary">
            <a href="/groups">Group tables</a>
          </nav>
        </div>
      </header>

      <main className="wrap">
        <p className="lead">
          Follow the <strong>FIFA World Cup 2026</strong> with live in-play scores,
          the full fixture schedule, and results with goal scorers and cards. Every
          match shows the <strong>UK TV channel</strong> (BBC or ITV) and its kick-off
          time in your local timezone — updated automatically as games kick off.
        </p>

        <Fixtures initial={payload} />
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <p>
            Data via{" "}
            <a href="https://www.football-data.org/" rel="noopener" target="_blank">
              football-data.org
            </a>
            . Auto-refreshes every 15s during live matches · times shown in your local timezone.
          </p>
          <p>
            <a href="/groups">Group standings &amp; tables →</a>
          </p>
        </div>
      </footer>
    </>
  );
}
