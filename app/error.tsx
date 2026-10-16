'use client';
import Link from 'next/link';
import {useEffect} from 'react';
/** Safe error reference without exposing customer details or runtime secrets. */
export default function ErrorPage({error,reset}:{error:Error & {digest?:string};reset:()=>void}){
 useEffect(()=>{console.error('[Charis page error]', error.digest||'client-render-error');},[error]);
 return <main className="shell section"><div className="panel">
  <h1>This page could not be loaded</h1>
  <p>The request could not be completed. If you were sending a campaign, review Delivery status before trying again.</p>
  {error.digest&&<p className="muted">Support reference: <code>{error.digest}</code></p>}
  <div className="actions"><button type="button" className="btn" onClick={reset}>Try again</button><Link className="btn secondary" href="/dashboard">Return to overview</Link></div>
 </div></main>;
}
