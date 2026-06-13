import Fixtures from "@/components/Fixtures";

export default function Home() {
  return (
    <>
      <header className="site-header">
        <div className="wrap">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">⚽</span>
            <div>
              <h1>World Cup 2026</h1>
              <p className="tagline">Live Fixtures &amp; Results</p>
            </div>
          </div>
        </div>
      </header>

      <main className="wrap">
        <Fixtures />
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
        </div>
      </footer>
    </>
  );
}
