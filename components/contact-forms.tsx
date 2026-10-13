'use client';
import {useActionState, useEffect, useState} from 'react';
import {saveContact,createList,changeListMembership,createSegment} from '@/app/dashboard/contacts/actions';
function Feedback({state}:{state:{error?:string;success?:string}}){return <p aria-live="polite" role="status" className={state.error?'feedback-error':'feedback-success'}>{state.error||state.success}</p>}
export type ExistingContact={id:string;first_name:string;last_name:string;email:string|null;phone:string|null;consent_status:'unknown'|'granted'|'denied';consent_evidence:string|null;attributes?:Record<string,string>};
export function ContactForm({org,initial}:{org:string;initial?:ExistingContact}){
 const [state,action,pending]=useActionState(saveContact,{});
 const [consent,setConsent]=useState<'unknown'|'granted'|'denied'>(initial?.consent_status||'unknown');
 const [dismissed,setDismissed]=useState(false);
 const [details,setDetails]=useState<{key:string;value:string}[]>(Object.entries(initial?.attributes||{}).slice(0,12).map(([key,value])=>({key,value:String(value)})));
 const keySafe=(key:string)=>key.trim().toLowerCase().replace(/[^a-z0-9_]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40);
 // Do not keep showing an error from an earlier attempt after the input has changed.
 useEffect(()=>{setDismissed(false);},[state]);
 return <form action={action} className="admin-form" onInputCapture={()=>setDismissed(true)} onChangeCapture={()=>setDismissed(true)}>
 <h2>{initial?'Edit contact':'Add a contact'}</h2>
 <input type="hidden" name="organization_id" value={org}/><input type="hidden" name="contact_id" value={initial?.id||''}/>
 <div className="form-two"><label>First name<input name="first_name" defaultValue={initial?.first_name||''} placeholder="Ada" maxLength={100}/></label><label>Last name<input name="last_name" defaultValue={initial?.last_name||''} placeholder="Okafor" maxLength={100}/></label></div>
 <div className="form-two"><label>Email address<input name="email" defaultValue={initial?.email||''} type="email" placeholder="ada@example.com" maxLength={254}/></label><label>Phone (international format)<input name="phone" defaultValue={initial?.phone||''} type="tel" placeholder="+2348031234567" pattern="\+[1-9][0-9]{7,14}"/></label></div>
 <p className="muted">An email or phone number is required. Only record marketing consent you can document.</p>
 <label>Marketing email consent<select name="consent_status" value={consent} onChange={e=>setConsent(e.target.value as 'unknown'|'granted'|'denied')}><option value="unknown">Unknown (not approved for marketing)</option><option value="granted">Explicit opt-in documented</option><option value="denied">Declined / opted out</option></select></label>
 {consent==='granted'?<label>Evidence of explicit consent (required)<textarea name="consent_evidence" defaultValue={initial?.consent_evidence||''} minLength={6} maxLength={500} required rows={2} placeholder="e.g. Web registration opt-in recorded on 2026-10-10"/></label>:<><input type="hidden" name="consent_evidence" value=""/><p className="muted">This contact can be saved, but will not be eligible for marketing campaigns without documented opt-in.</p></>}
 <input type="hidden" name="custom_details" value={JSON.stringify(Object.fromEntries(details.filter(d=>d.key.trim()&&d.value.trim()).map(d=>[keySafe(d.key),d.value.trim()])))} />
 <details className="charis-quick-group"><summary>Extra customer details (optional)</summary><p className="muted">Store details such as branch, product or account reference. Never enter PINs, BVNs, passwords or full account numbers.</p>
 {details.map((item,i)=><div className="form-two" key={i}><label>Field name<input value={item.key} maxLength={40} placeholder="branch" onChange={e=>setDetails(old=>old.map((d,j)=>i===j?{...d,key:e.target.value}:d))}/></label><label>Value<input value={item.value} maxLength={200} placeholder="Surulere" onChange={e=>setDetails(old=>old.map((d,j)=>i===j?{...d,value:e.target.value}:d))}/></label><button type="button" className="btn secondary" onClick={()=>setDetails(old=>old.filter((_,j)=>i!==j))}>Remove</button></div>)}
 <button type="button" className="btn secondary" disabled={details.length>=12} onClick={()=>setDetails(old=>[...old,{key:'',value:''}])}>Add a field</button>
 <p className="muted">These details can be inserted into a campaign using the customer-detail buttons.</p></details>
 <button className="btn" disabled={pending}>{pending?'Saving…':initial?'Save changes':'Save contact'}</button>
 {!dismissed&&<Feedback state={state}/>}
 </form>;
}
export function ContactListForm({org}:{org:string}){
 const [state,action,pending]=useActionState(createList,{});
 return <form action={action} className="admin-form"><h2>Create customer group</h2><input name="organization_id" type="hidden" value={org}/><label>Group name<input name="name" required minLength={2} maxLength={100} placeholder="October newsletter audience"/></label><label>Description<textarea name="description" rows={2} maxLength={500} placeholder="Why this audience is grouped together"/></label><button className="btn" disabled={pending}>{pending?'Creating…':'Create group'}</button><Feedback state={state}/></form>
}
export function ListMembershipForm({org,lists,contacts}:{org:string;lists:{id:string;name:string}[];contacts:{id:string;name:string}[]}){
 const [state,action,pending]=useActionState(changeListMembership,{});
 return <form action={action} className="admin-form"><h2>Manage list members</h2><input name="organization_id" type="hidden" value={org}/><label>Contact<select name="contact_id" required>{contacts.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label><label>List<select name="list_id" required>{lists.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label><label>Action<select name="add"><option value="true">Add contact</option><option value="false">Remove contact</option></select></label><button className="btn" disabled={pending||!lists.length||!contacts.length}>{pending?'Applying…':'Update membership'}</button><p className="muted">Showing the first 100 contacts. Use the Contacts page to manage larger audiences.</p><Feedback state={state}/></form>
}
export function SegmentForm({org}:{org:string}){
 const [state,action,pending]=useActionState(createSegment,{});
 return <form action={action} className="admin-form"><h2>Create smart group</h2><input name="organization_id" type="hidden" value={org}/><label>Group name<input name="name" required minLength={2} maxLength={100} placeholder="Consented newsletter recipients"/></label><label>Description<input name="description" maxLength={500}/></label><label>Marketing consent<select name="consent_status"><option value="">Any</option><option value="granted">Explicit opt-in</option><option value="unknown">Unknown</option><option value="denied">Declined</option></select></label><label>Contact source<select name="source"><option value="">Any</option><option value="manual">Added manually</option><option value="import">Imported from file</option></select></label><label>Email availability<select name="has_email"><option value="">Any</option><option value="yes">Has email address</option><option value="no">No email address</option></select></label><p className="muted">Choose at least one rule. Customers appear in this group whenever they match all your rules.</p><button className="btn" disabled={pending}>{pending?'Saving…':'Save smart group'}</button><Feedback state={state}/></form>
}
