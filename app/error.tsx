'use client';
import Link from 'next/link';
import {useEffect} from 'react';
/** Safe error reference without exposing customer details or runtime secrets. */
export default function ErrorPage({error}:{error:Error & {digest?:string};reset:()=>void}){
 useEffect(()=>{console.error('[Charis page error]', error.digest||'client-render-error');},[error]);
 return <main className="shell section"><div className="panel">
  <h1>This page could not be loaded</h1>
  <p>The request could not be completed. If you recently submitted a campaign, check its status before sending again.</p>
  {error.digest&&<p className="muted">Support reference: <code>{error.digest}</code></p>}
  <div className="actions"><a className="btn" href="/dashboard/communications">Check campaigns</a><a className="btn secondary" href="/dashboard/communications/new">Reload campaign page</a><Link className="inline-link" href="/dashboard">Dashboard</Link></div>
 </div></main>;
}
