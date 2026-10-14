'use client';
import {useMemo,useState} from 'react';
import {previewProviderCapacity,type CapacityInput} from '@/lib/email/capacity-preview';
export function ProviderCapacityPlanner({providers}:{providers:CapacityInput[]}){
 const [size,setSize]=useState(1000);
 const estimate=useMemo(()=>previewProviderCapacity(size,providers),[size,providers]);
 return <section className="panel"><h2>Provider capacity estimate</h2>
  <p className="muted">Planning only. Estimates are based on the limits YOU configured, not on free-plan entitlements or approval for marketing. They do not queue or send emails.</p>
  <label>How many eligible emails are you planning?<input type="number" min={0} max={1000000} value={size} onChange={e=>setSize(Math.max(0,Math.min(1000000,Number(e.target.value)||0)))}/></label>
  <div className="audience-kpis"><div className="audience-kpi"><span>Configured daily total</span><strong>{estimate.perDay.toLocaleString()}</strong></div><div className="audience-kpi"><span>Estimated days</span><strong>{estimate.days||'—'}</strong></div></div>
  <div className="table-scroll"><table className="admin-table"><thead><tr><th>Connected service</th><th>Configured daily limit</th><th>Estimated allocation</th></tr></thead><tbody>{estimate.providers.map(p=><tr key={p.provider}><td>{p.provider}</td><td>{p.dailyLimit}</td><td>{p.allocated.toLocaleString()}</td></tr>)}</tbody></table></div>
  {!estimate.providers.length&&<p className="muted">No enabled provider with a successful connection check. Configure and verify a provider first.</p>}
  <p className="muted">Marketing campaigns need a provider-approved marketing workflow and a verified sender. This estimate cannot override sending limits, consent or delivery safeguards.</p>
 </section>;
}
