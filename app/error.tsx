'use client';
import {RefreshCw} from 'lucide-react';

export default function ErrorPage({reset}: {reset: () => void}) {
  return (
    <div className="public-simple">
      <div className="public-card">
        <h1 style={{fontSize: 24}}>This page could not be loaded</h1>
        <p>Something went wrong on our side. Please try again. If the problem continues, contact your system administrator.</p>
        <button className="btn" onClick={reset}><RefreshCw size={16}/> Try again</button>
      </div>
    </div>
  );
}
