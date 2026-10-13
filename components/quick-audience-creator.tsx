'use client';
import {useState} from 'react';

type Choice={id:string;name:string};
export function QuickAudienceCreator({org,onCreated}:{org:string;onCreated:(kind:'list'|'segment',entry:Choice)=>void}){
 const [mode,setMode]=useState<'list'|'segment'>('list');
 const [name,setName]=useState('');
 const [consent,setConsent]=useState('granted');
 const [source,setSource]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 async function submit(){
  if(name.trim().length<2){setMessage('Enter a group name of at least two characters.');return;}
  setBusy(true);setMessage('');
  try{
   const payload=mode==='list'?{organization_id:org,name:name.trim()}:{organization_id:org,name:name.trim(),rules:{consent_status:consent,...(source?{source}:{}) ,has_email:true}};
   const response=await fetch(mode==='list'?'/api/contacts/lists':'/api/contacts/segments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to create group');
   if(typeof data.id!=='string')throw new Error('The server did not return the saved group.');
   onCreated(mode,{id:data.id,name:name.trim()});setName('');setMessage('Group created. It is now selected for this campaign.');
  }catch(error){setMessage(error instanceof Error?error.message:'Could not create group');}
  finally{setBusy(false);}
 }
 return <details className="charis-quick-group"><summary>Create a group here <span aria-hidden="true">＋</span></summary>
  <div className="admin-form"><h3>New customer group</h3><p className="muted">A saved group contains people you choose. A smart group updates automatically using rules.</p>
   <label>Group type<select value={mode} onChange={e=>setMode(e.target.value as 'list'|'segment')}><option value="list">Saved group (choose members yourself)</option><option value="segment">Smart group (automatic rules)</option></select></label>
   <label>Group name<input value={name} onChange={e=>setName(e.target.value)} maxLength={100} minLength={2} placeholder="October customer updates" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void submit();}}}/></label>
   {mode==='segment'&&<><label>Who should be included?<select value={consent} onChange={e=>setConsent(e.target.value)}><option value="granted">Customers who agreed to email marketing</option><option value="unknown">Customers with no marketing permission recorded</option><option value="denied">Customers who opted out</option></select></label><label>Contact source<select value={source} onChange={e=>setSource(e.target.value)}><option value="">All sources</option><option value="import">Uploaded contacts</option><option value="manual">Manually entered contacts</option></select></label></>}
   <button type="button" onClick={submit} className="btn" disabled={busy}>{busy?'Creating…':'Create and select group'}</button><p aria-live="polite" role="status" className="muted">{message}</p>
   {mode==='list'&&<p className="muted">Your new group starts empty. <a href={`/dashboard/lists?org=${encodeURIComponent(org)}`} className="inline-link">Add customers to your group</a> before sending.</p>}
  </div>
 </details>;
}
