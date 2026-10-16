 'use client';
import {useActionState,useState} from 'react';
import Link from 'next/link';
import {createDirectMessage} from '@/app/dashboard/communications/actions';
type Contact={id:string;first_name:string|null;last_name:string|null;email:string|null;phone:string|null};
type Group={id:string;name:string};
export function DirectCompose({token,contacts,groups,canBulk,emailEnabled,smsEnabled,maxRecipients}:{token:string;contacts:Contact[];groups:Group[];canBulk:boolean;emailEnabled:boolean;smsEnabled:boolean;maxRecipients:number}){
 const [state,submit,pending]=useActionState(createDirectMessage,{});
 const [channel,setChannel]=useState<'email'|'sms'>(emailEnabled?'email':'sms');const [audience,setAudience]=useState<'selected'|'list'|'all'>('selected');const [chosen,setChosen]=useState<string[]>([]);
 const [query,setQuery]=useState('');const [body,setBody]=useState('');
 const [directory,setDirectory]=useState(contacts);const [searching,setSearching]=useState(false);const [searchError,setSearchError]=useState('');
 const searchAll=async()=>{setSearching(true);setSearchError('');try{const response=await fetch('/api/direct/contacts?q='+encodeURIComponent(query),{cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'Search failed');setDirectory(old=>[...old,...(data.contacts as Contact[]).filter(c=>!old.some(o=>o.id===c.id))]);}catch(e){setSearchError(e instanceof Error?e.message:'Directory search failed');}finally{setSearching(false)}};
 const filtered=directory.filter(c=>`${c.first_name||''} ${c.last_name||''} ${c.email||''} ${c.phone||''}`.toLowerCase().includes(query.toLowerCase())).slice(0,80);
 return <form action={submit} className="admin-form direct-composer" style={{maxWidth:'none'}}>
  <input type="hidden" name="token" value={token}/><input type="hidden" name="contact_ids" value={chosen.join(',')}/>
  <div className="direct-simple-steps"><span>1. Message</span><span>2. Recipients</span><span>3. Send</span></div>
  <div className="form-two"><label>Channel<select name="channel" value={channel} onChange={e=>setChannel(e.target.value as 'email'|'sms')}>
   {emailEnabled&&<option value="email">Email</option>}{smsEnabled&&<option value="sms">SMS</option>}</select></label>
   <label>Communication type<select name="purpose" defaultValue="general_notice"><option value="general_notice">General bank notice</option><option value="service_notice">Service update</option><option value="account_update">Account notification</option></select></label></div>
  <div className="form-two"><label>Related product (optional)<select name="product" defaultValue="general"><option value="general">General / Not applicable</option><option value="savings">Savings</option><option value="current">Current account</option><option value="fixed_deposit">Fixed deposit</option><option value="loans">Loans</option><option value="mobile_app">Mobile banking</option><option value="other">Other</option></select></label>
   <label>Message label<input name="title" required maxLength={120} placeholder="e.g. Banking service update"/></label></div>
  <label>{channel==='email'?'Email subject':'Message label / subject'}<input name="subject" required maxLength={180} placeholder="e.g. An update from Charis MFB"/></label>
  <label>Message<textarea name="body" rows={6} required minLength={10} maxLength={channel==='sms'?480:2000} value={body} onChange={e=>setBody(e.target.value)} placeholder="Write your banking communication clearly. Never request a PIN, password or OTP."/></label>
  <small className="muted">{body.length}/{channel==='sms'?480:2000} characters · Promotions must use the separate consent-controlled marketing workflow.</small>
  <div className="direct-audience-head"><h3>Recipients</h3><small className="muted">Maximum {maxRecipients} per message</small></div>
  <label>Send to<select name="audience" value={audience} onChange={e=>{setAudience(e.target.value as 'selected'|'list'|'all');setChosen([]);}}>
   <option value="selected">Selected customers</option>{canBulk&&<option value="list">Saved customer group</option>}{canBulk&&<option value="all">All customers I am authorised to contact (within limit)</option>}</select></label>
  {audience==='selected'&&<div className="direct-contact-panel"><input aria-label="Find customers" placeholder="Search customers by name, email or phone" value={query} onChange={e=>setQuery(e.target.value)} className="direct-search"/>
   <button type="button" className="btn secondary" onClick={searchAll} disabled={searching||query.trim().length<2}>{searching?'Searching…':'Search full directory'}</button>{searchError&&<p role="alert" className="feedback-error">{searchError}</p>}<div className="direct-contact-list">{filtered.filter(c=>channel==='email'?!!c.email:!!c.phone).map(c=><label className="direct-contact-row" key={c.id}><input type="checkbox" checked={chosen.includes(c.id)} onChange={e=>setChosen(old=>e.target.checked?(old.length>=maxRecipients?old:[...old,c.id]):old.filter(id=>id!==c.id))}/><span><strong>{[c.first_name,c.last_name].filter(Boolean).join(' ')||'Customer'}</strong><small>{channel==='email'?c.email:c.phone}</small></span></label>)}</div>
   <p className="muted">{chosen.length} selected · Customers shown are limited to your authorised visibility. Use a saved group for a larger audience.</p></div>}
  {audience==='list'&&<label>Saved group<select name="list_id" required><option value="">Choose group</option>{groups.map(g=><option value={g.id} key={g.id}>{g.name}</option>)}</select></label>}
  {audience==='all'&&<p className="notice">This sends only to active, accessible customers with valid {channel==='email'?'email addresses':'phone numbers'}. If more than {maxRecipients} qualify, the system will refuse the operation so you can select a smaller group.</p>}
  <p className="muted">Delivery is restricted to authorised customers, verified senders and the bank&apos;s configured sending limits. Provider selection is automatic.</p>
  <button className="btn" disabled={pending||(!emailEnabled&&!smsEnabled)||(audience==='selected'&&chosen.length===0)}>{pending?'Submitting securely…':'Send now'}</button>
  {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}
  {state.success&&<div role="status" className="notice"><strong>{state.success}</strong> {state.id&&<Link className="inline-link" href="/dashboard/communications">View delivery history →</Link>}</div>}
 </form>;
}
