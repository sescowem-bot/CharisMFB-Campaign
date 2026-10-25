'use client';
import Link from 'next/link';
import {useMemo,useState} from 'react';
import {Search,Mail,MessageSquare,CheckCircle2,Clock3,AlertTriangle,Archive,Eye} from 'lucide-react';
import {messageStatusLabel} from '@/lib/direct/delivery-view';
import {DirectApprovalForm} from '@/components/direct-approval-form';
import './direct-delivery-history.css';

export type CampaignHistoryItem={
 id:string;title:string;subject:string;channel:string;purpose:string;status:string;
 recipient_count:number;created_at:string;scheduled_at:string|null;created_by:string;
};
export function CampaignHistoryTable({messages,archived,canApprove,accountId}:{
 messages:CampaignHistoryItem[];archived:boolean;canApprove:boolean;accountId:string;
}){
 const [search,setSearch]=useState('');
 const [filter,setFilter]=useState('all');
 const counts=useMemo(()=>({
  total:messages.length,
  pending:messages.filter(m=>['queued','pending_approval','sending'].includes(m.status)).length,
  reviewed:messages.filter(m=>['paused','cancelled'].includes(m.status)).length,
  processed:messages.filter(m=>m.status==='completed').length
 }),[messages]);
 const visible=useMemo(()=>messages.filter(m=>{
  const type=filter==='all'||(filter==='pending'&&['queued','pending_approval','sending'].includes(m.status))||
   (filter==='processed'&&m.status==='completed')||(filter==='review'&&['paused','cancelled'].includes(m.status));
  return type&&[m.title,m.subject,m.channel,m.status,m.purpose].join(' ').toLowerCase().includes(search.trim().toLowerCase());
 }),[messages,filter,search]);
 return <div className="charis-history">
  <div className="charis-history-metrics" aria-label="Campaign overview">
   <div><span><Mail size={16}/> {archived?'Archived records':'Recent campaigns'}</span><strong>{counts.total}</strong><small>Last {messages.length} accessible records</small></div>
   <div><span><Clock3 size={16}/> Waiting or sending</span><strong>{counts.pending}</strong><small>Queued, awaiting approval or sending</small></div>
   <div><span><CheckCircle2 size={16}/> Processed</span><strong>{counts.processed}</strong><small>Not necessarily delivered to inboxes</small></div>
   <div><span><AlertTriangle size={16}/> Needs attention</span><strong>{counts.reviewed}</strong><small>Paused or cancelled</small></div>
  </div>
  <div className="charis-history-tools">
   <label className="charis-history-search"><Search size={18}/><input aria-label="Search campaign history" placeholder="Search campaign or subject…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   <label className="charis-history-filter">Show<select aria-label="Filter campaign status" value={filter} onChange={e=>setFilter(e.target.value)}>
    <option value="all">All statuses</option><option value="pending">Waiting or sending</option><option value="processed">Processed</option><option value="review">Needs attention</option>
   </select></label>
  </div>
  <p className="charis-history-count" role="status">{visible.length} of {messages.length} campaigns shown. Statuses reflect the latest recorded information.</p>
  {visible.length?<div className="table-scroll"><table className="admin-table charis-history-table">
   <thead><tr><th>Campaign</th><th>Channel</th><th>Recipients</th><th>Status</th><th>Date (WAT)</th><th>Action</th></tr></thead>
   <tbody>{visible.map(m=><tr key={m.id}>
    <td><strong>{m.title||'Untitled campaign'}</strong><small>{m.subject}</small></td>
    <td><span className="charis-history-channel">{m.channel==='email'?<Mail size={15}/>:<MessageSquare size={15}/>} {m.channel==='email'?'Email':'SMS'}</span></td>
    <td>{m.recipient_count}</td>
    <td><span className={'charis-history-status charis-history-status-'+(['queued','pending_approval','sending'].includes(m.status)?'pending':m.status==='completed'?'done':['paused','cancelled'].includes(m.status)?'review':'neutral')}>{messageStatusLabel(m.status,m.scheduled_at)}</span></td>
    <td className="charis-history-date">{m.scheduled_at&&new Date(m.scheduled_at).getTime()>Date.now()?'Scheduled: ':'Created: '}{new Date(m.scheduled_at&&new Date(m.scheduled_at).getTime()>Date.now()?m.scheduled_at:m.created_at).toLocaleString('en-NG',{timeZone:'Africa/Lagos',dateStyle:'medium',timeStyle:'short'})}</td>
    <td><Link className="charis-history-open" href={'/dashboard/communications/history?id='+m.id}><Eye size={15}/> View details</Link>{!archived&&m.status==='pending_approval'&&canApprove&&m.created_by!==accountId&&<DirectApprovalForm id={m.id}/>}</td>
   </tr>)}</tbody>
  </table></div>:<div className="charis-history-empty"><Archive size={25}/><strong>No matching campaigns</strong><span>Try another search or select All statuses.</span><button type="button" onClick={()=>{setSearch('');setFilter('all');}}>Clear filters</button></div>}
 </div>;
}
