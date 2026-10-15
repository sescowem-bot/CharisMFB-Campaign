'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';

type Batch={id:string;batch_key:string;inserted_count:number;skipped_count:number;rejected_count:number;created_at:string};
type Issue={id:string;source_row:number;issue_type:'duplicate'|'invalid';reason_code:string;first_name:string;last_name:string;email:string|null;phone:string|null;resolution:'unresolved'|'reviewed'|'corrected'|'kept_existing'};
const messages:Record<string,string>={
 existing_email:'Email address already belongs to an existing customer.',
 suppressed_email:'This address is on the bank suppression list. It was not added or opted back in.',
 existing_phone:'Phone number is already saved for a customer.',
 concurrent_duplicate:'This customer was saved by another import at the same time.',
 missing_identity:'Both email and phone are missing.',
 invalid_email:'Email address is not in a valid format.',
 invalid_phone:'Phone number needs a country code, such as +234.',
 invalid_name:'The name is longer than allowed.',
 invalid_attributes:'An extra field has an invalid name or value.',
 invalid_row:'This row could not be read.'
};
const formatDate=(date:string)=>new Date(date).toLocaleString('en-NG',{dateStyle:'medium',timeStyle:'short'});

function IssueItem({org,item,onReviewed}:{org:string;item:Issue;onReviewed:(id:string,resolution:Issue['resolution'])=>void}){
 const [editing,setEditing]=useState(false);
 const [first,setFirst]=useState(item.first_name);
 const [last,setLast]=useState(item.last_name);
 const [email,setEmail]=useState(item.email||'');
 const [phone,setPhone]=useState(item.phone||'');
 const [pending,setPending]=useState(false);
 const [consentSource,setConsentSource]=useState('consent_register');
 const [consentRef,setConsentRef]=useState('');
 const [consentDate,setConsentDate]=useState('');
 const [consentConfirmed,setConsentConfirmed]=useState(false);
 const [error,setError]=useState('');
 const lookup=item.reason_code==='existing_phone'?item.phone||'':item.reason_code==='existing_email'?item.email||'':item.email||item.phone||'';
 async function resolve(resolution:'reviewed'|'kept_existing'|'corrected'){
  const response=await fetch('/api/contacts/import/issues',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({org,id:item.id,resolution})});
  const result=await response.json();
  if(!response.ok||!result.updated)throw new Error(result.error||'Unable to update review status.');
  onReviewed(item.id,resolution);
 }
 async function submitCorrection(){
  setPending(true);setError('');
  try{
   if(!email.trim()&&!phone.trim())throw new Error('Enter an email address or phone number.');
   if(!consentConfirmed||consentRef.trim().length<8||!consentDate)throw new Error('Confirm the existing consent evidence, date and reference before retrying.');
   const response=await fetch('/api/contacts/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization_id:org,batch_key:crypto.randomUUID(),rows:[{source_row:item.source_row,first_name:first.trim(),last_name:last.trim(),email:email.trim().toLowerCase(),phone:phone.trim(),attributes:{}}],consent:{confirmed:true,source:consentSource,reference:consentRef.trim(),recorded_on:consentDate,scope:'all_marketing',product:''}})});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||'The corrected customer could not be imported.');
   if(result.inserted===1){await resolve('corrected');setEditing(false);}
   else if(result.skipped)throw new Error('This customer already exists. Use Find customer to review the existing record.');
   else throw new Error('The row is still invalid. Check the email and phone number and try again.');
  }catch(e){setError(e instanceof Error?e.message:'Could not save correction.');}
  finally{setPending(false);}
 }
 async function markReviewed(resolution:'reviewed'|'kept_existing'){
  setPending(true);setError('');try{await resolve(resolution);}catch(e){setError(e instanceof Error?e.message:'Could not mark row reviewed.');}finally{setPending(false);}
 }
 return <div className="charis-import-issue" key={item.id}>
  <div className="charis-import-issue-heading"><strong>Excel row {item.source_row} · {item.reason_code==='suppressed_email'?'Suppressed':item.issue_type==='duplicate'?'Duplicate':'Needs correction'}</strong><span className={item.resolution==='unresolved'?'muted':'feedback-success'}>{item.resolution==='unresolved'?'Not reviewed':item.resolution.replaceAll('_',' ')}</span></div>
  <p>{[item.first_name,item.last_name].filter(Boolean).join(' ')||'Unnamed customer'} · {item.email||item.phone||'No contact details'}</p>
  <p className="muted">{messages[item.reason_code]||'Review the customer details.'}</p>
  {item.resolution==='unresolved'&&<div className="workspace-links">
   {lookup&&<Link className="btn secondary" href={`/dashboard/contacts?org=${org}&q=${encodeURIComponent(lookup)}`}>Find customer</Link>}
   {item.issue_type==='invalid'&&<button className="btn secondary" type="button" onClick={()=>setEditing(!editing)}>{editing?'Close correction':'Correct and retry'}</button>}
   <button className="btn secondary" type="button" disabled={pending} onClick={()=>markReviewed(item.issue_type==='duplicate'?'kept_existing':'reviewed')}>{pending?'Saving…':item.reason_code==='suppressed_email'?'Mark suppression reviewed':item.issue_type==='duplicate'?'Keep existing customer':'Mark reviewed'}</button>
  </div>}
  {editing&&item.resolution==='unresolved'&&<div className="charis-import-correction"><p className="muted">Correct the contact details and retry as a new customer. A correction will not overwrite existing customers and requires documented prior permission. Existing opt-outs remain blocked.</p>
   <div className="form-two"><label>First name<input value={first} onChange={e=>setFirst(e.target.value)} maxLength={100}/></label><label>Last name<input value={last} onChange={e=>setLast(e.target.value)} maxLength={100}/></label></div>
   <div className="form-two"><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254}/></label><label>Phone (+country code)<input value={phone} onChange={e=>setPhone(e.target.value)} maxLength={20} placeholder="+2348012345678"/></label></div>
   <label>Original consent source<select value={consentSource} onChange={e=>setConsentSource(e.target.value)}><option value="consent_register">Bank consent register</option><option value="signed_form">Signed form</option><option value="digital_form">Online opt-in form</option><option value="recorded_call">Recorded customer permission</option><option value="other">Other documented evidence</option></select></label>
   <label>Consent evidence reference<input value={consentRef} maxLength={200} onChange={e=>setConsentRef(e.target.value)}/></label>
   <label>Consent date<input type="date" value={consentDate} max={new Date().toISOString().slice(0,10)} onChange={e=>setConsentDate(e.target.value)}/></label>
   <label><input type="checkbox" checked={consentConfirmed} onChange={e=>setConsentConfirmed(e.target.checked)}/> I verified this customer already opted into all Charis promotional updates.</label>
   <button type="button" className="btn" disabled={pending||!consentConfirmed||consentRef.length<8||!consentDate} onClick={submitCorrection}>{pending?'Checking…':'Retry this row'}</button>
  </div>}
  {error&&<p role="alert" className="feedback-error">{error}</p>}
 </div>;
}

export function ImportIssueReview({org,batches,initial}:{org:string;batches:Batch[];initial?:string}){
 const [selected,setSelected]=useState(initial&&batches.some(b=>b.id===initial)?initial:'');
 const [issues,setIssues]=useState<Issue[]>([]);
 const [batch,setBatch]=useState<Batch|null>(null);
 const [legacy,setLegacy]=useState(false);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [filter,setFilter]=useState<'all'|'duplicate'|'invalid'|'unresolved'>('all');
 const filtered=issues.filter(issue=>filter==='all'||(filter==='unresolved'?issue.resolution==='unresolved':issue.issue_type===filter));
 function downloadIssues(){
  const escapeCell=(value:string|number|null)=>{let text=String(value??'');if(/^[\s]*[=+\-@]/.test(text))text=`'${text}`;return `"${text.replaceAll('\"','\"\"')}"`;};
  const rows=[['Row','Issue','Reason','First name','Last name','Email','Phone','Review status'],...issues.map(item=>[String(item.source_row),item.issue_type,messages[item.reason_code]||item.reason_code,item.first_name,item.last_name,item.email||'',item.phone||'',item.resolution])];
  const csv=rows.map(row=>row.map(escapeCell).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download='Charis-import-review.csv';document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 useEffect(()=>{
  if(!selected){setIssues([]);setBatch(null);return;}
  const controller=new AbortController();
  // Use the current staff session. Never cache bank customer identifiers.
  fetch(`/api/contacts/import/issues?org=${encodeURIComponent(org)}&batch=${encodeURIComponent(selected)}`,{signal:controller.signal,cache:'no-store'})
   .then(async response=>{const json=await response.json();if(!response.ok)throw Error(json.error||'Unable to load import review.');return json;})
   .then(data=>{if(controller.signal.aborted)return;setIssues(data.issues||[]);setBatch(data.batch);setLegacy(Boolean(data.hasLegacySummary));setError('');setLoading(false);})
   .catch(e=>{if(!controller.signal.aborted){setError(e instanceof Error?e.message:'Unable to load import review.');setLoading(false);}});
  return ()=>controller.abort();
 },[org,selected]);
 return <section id="import-review" className="admin-form charis-import-review">
  <h2>Review duplicate and invalid rows</h2>
  <p className="muted">Check skipped rows, see why an entry failed, find the existing customer or correct one record at a time. No existing customer or marketing permission is overwritten.</p>
  {!batches.length?<p className="muted">No previous imports found.</p>:<label>Choose a recent import batch<select value={selected} onChange={e=>{setLoading(true);setSelected(e.target.value);}}><option value="">Choose an import to review</option>{batches.map(b=><option key={b.id} value={b.id}>{formatDate(b.created_at)} · {b.inserted_count} added · {b.skipped_count} duplicates · {b.rejected_count} invalid</option>)}</select></label>}
  {loading&&<p role="status" className="muted">Loading this import...</p>}
  {error&&<p role="alert" className="feedback-error">{error}</p>}
  {batch&&!loading&&<><div className="audience-kpis"><div className="audience-kpi"><span>Added</span><strong>{batch.inserted_count}</strong></div><div className="audience-kpi"><span>Duplicates</span><strong>{batch.skipped_count}</strong></div><div className="audience-kpi"><span>Invalid</span><strong>{batch.rejected_count}</strong></div></div>
   {legacy&&<p className="notice">This batch was imported before row-level review was enabled. Its totals are available, but the original rejected and duplicate rows were not stored. Re-upload the source spreadsheet for a new review.</p>}
   {issues.length===0&&!legacy&&<p className="feedback-success">No duplicate or invalid rows were recorded for this batch.</p>}
   {issues.length>0&&<div className="workspace-links"><label>Show<select value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}><option value="all">All issues</option><option value="duplicate">Duplicates</option><option value="invalid">Invalid rows</option><option value="unresolved">Not reviewed</option></select></label><button className="btn secondary" type="button" onClick={downloadIssues}>Download review CSV</button></div>}
   {filtered.map(issue=><IssueItem key={issue.id} org={org} item={issue} onReviewed={(id,resolution)=>setIssues(current=>current.map(v=>v.id===id?{...v,resolution}:v))}/>)}
  </>}
 </section>;
}
