import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="public-simple">
      <div className="public-card">
        <span className="eyebrow">Error 404</span>
        <h1 style={{fontSize: 26}}>We couldn’t find that page</h1>
        <p>The link may be outdated or you may not have access to it.</p>
        <Link className="btn" href="/dashboard">Back to dashboard</Link>
      </div>
    </div>
  );
}
