export default function MatchNotFound() {
  return (
    <main className="wrap">
      <div className="state">
        <span className="emoji" aria-hidden="true">🔍</span>
        <h1>Match not found</h1>
        <p>
          That match doesn’t exist or hasn’t been scheduled yet.{" "}
          <a href="/">Back to all fixtures →</a>
        </p>
      </div>
    </main>
  );
}
