'use client';
import {useMemo,useState} from 'react';
import {Search,RefreshCcw} from 'lucide-react';
import {recipientStatusLabel} from '@/lib/direct/delivery-view';
import './direct-delivery-history.css';

type Outcome={status:string;provider:string|null;error_code:string|null;updated_at:string};
export function DirectRecipientOutcomes({rows}:{rows:Outcome[]}){
 const [filter,setFilter]=useState('all');
 const [search,setSearch]=useState('');
 const outcomes=useMemo(()=>rows.filter(r=>{
  const statusOk=filter==='all'||r.status===filter;
  const searchOk=[r.provider||'',r.status,r.error_code||''].join(' ').toLowerCase().includes(search.toLowerCase());
  return statusOk&&searchOk;
 }),[rows,filter,search]);
 const options=[...new Set(rows.map(r=>r.status))].sort();
 return <div className="charis-outcomes">
  <div className="charis-history-tools">
   <label className="charis-history-search"><Search size={17}/><input aria-label="Search delivery outcomes" value={search} placeholder="Search status, provider or error code…" onChange={e=>setSearch(e.target.value)}/></label>
   <label className="charis-history-filter">Status<select aria-label="Filter delivery outcomes" value={filter} onChange={e=>setFilter(e.target.value)}>
    <option value="all">All outcomes</option>{options.map(v=><option key={v} value={v}>{recipientStatusLabel(v)}</option>)}
   </select></label>
  </div>
  <p className="charis-history-count" role="status">{outcomes.length} of {rows.length} recipient outcomes shown. Refresh the page for the latest provider reports.</p>
  {outcomes.length?<div className="table-scroll"><table className="admin-table charis-history-table">
   <thead><tr><th>Status</th><th>Provider</th><th>Reason (where available)</th><th>Last update (WAT)</th></tr></thead>
   <tbody>{outcomes.map((r,i)=><tr key={i}><td><span className={'charis-history-status charis-history-status-'+(['pending','sending'].includes(r.status)?'pending':['delivered','accepted'].includes(r.status)?'done':['failed','bounced','blocked','unknown','complained'].includes(r.status)?'review':'neutral')}>{recipientStatusLabel(r.status)}</span></td>
    <td>{r.provider||'Not assigned'}</td>
    <td>{['failed','unknown','skipped','bounced','complained','unsubscribed','blocked'].includes(r.status)?r.error_code||'No reason supplied':'—'}</td>
    <td>{new Date(r.updated_at).toLocaleString('en-NG',{timeZone:'Africa/Lagos',dateStyle:'medium',timeStyle:'short'})}</td></tr>)}</tbody>
  </table></div>:<div className="charis-history-empty"><RefreshCcw size={22}/><strong>No matching delivery outcomes</strong><span>Try another status or search.</span><button type="button" onClick={()=>{setFilter('all');setSearch('');}}>Clear filters</button></div>}
 </div>;
}
