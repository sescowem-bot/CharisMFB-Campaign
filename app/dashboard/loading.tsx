/** Instant skeleton shown while any dashboard page streams in. */
export default function Loading() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{height: 34, width: 260, marginBottom: 12}}/>
      <div className="skeleton" style={{height: 18, width: 420, maxWidth: '100%', marginBottom: 28}}/>
      <div className="stat-grid">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{height: 112}}/>)}</div>
      <div className="skeleton" style={{height: 280}}/>
    </div>
  );
}
