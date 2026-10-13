'use client';
import {useActionState} from 'react';
import {connectCharisResend,disableCharisSender,setupCharisResendDomain,checkCharisResendDomain,removePendingCharisDomain,removeUnusedCharisSender} from '@/app/dashboard/senders/charis-actions';

export function CharisResendForm({org,domains,defaultName,defaultLocal,defaultDomain,defaultReply}:{org:string;domains:string[];defaultName:string;defaultLocal:string;defaultDomain:string;defaultReply:string}){
 const [state,action,pending]=useActionState(connectCharisResend,{});
 return <form action={action} className="admin-form sender-form">
  <input type="hidden" name="organization_id" value={org}/>
  <h3>Sender identity</h3>
  <p className="muted">Choose a verified domain from the Resend account connected in Vercel. You can edit these fields without changing your API key or redeploying.</p>
  <label>Sender display name<input name="from_name" defaultValue={defaultName} maxLength={100} required placeholder="Charis Microfinance Bank"/></label>
  <div className="form-two">
   <label>Sender mailbox<input name="from_local" defaultValue={defaultLocal} maxLength={64} required placeholder="campaigns" autoCapitalize="none" autoComplete="off"/></label>
   <label>Verified sending domain<select name="from_domain" defaultValue={defaultDomain} required>{domains.map(d=><option key={d} value={d}>@{d}</option>)}</select></label>
  </div>
  <label>Reply-to email<input name="reply_to" type="email" defaultValue={defaultReply} maxLength={254} placeholder="Optional (uses sender email if blank)"/></label>
  <button className="btn" disabled={pending||!domains.length}>{pending?'Verifying and saving…':'Save sender settings'}</button>
  <div aria-live="polite">{state.error&&<p className="feedback-error" role="alert">{state.error}</p>}{state.success&&<p className="feedback-success" role="status">{state.success}</p>}</div>
 </form>;
}
export function DisableCharisSender({org,id}:{org:string;id:string}){
 const [state,action,pending]=useActionState(disableCharisSender,{});
 return <form action={action} className="sender-inline">
  <input type="hidden" name="organization_id" value={org}/><input type="hidden" name="sender_id" value={id}/>
  <button type="submit" className="btn secondary" disabled={pending}>{pending?'Disabling…':'Disable sender'}</button>
  {state.error&&<p className="feedback-error" role="alert">{state.error}</p>}{state.success&&<p className="feedback-success" role="status">{state.success}</p>}
 </form>;
}

export function CharisDomainConnectForm({org}:{org:string}){
 const [state,action,pending]=useActionState(setupCharisResendDomain,{});
 return <form action={action} className="admin-form">
  <input type="hidden" name="organization_id" value={org}/>
  <label>Already verified domain<input name="domain" required placeholder="sescoconcept.name.ng" autoCapitalize="none" autoComplete="off"/></label>
  <button className="btn" disabled={pending}>{pending?'Checking Resend…':'Use existing verified domain'}</button>
  {state.error&&<p className="feedback-error" role="alert">{state.error}</p>}{state.success&&<p className="feedback-success" role="status">{state.success}</p>}
 </form>;
}
export function CharisDomainCheckForm({org,id}:{org:string;id:string}){
 const [state,action,pending]=useActionState(checkCharisResendDomain,{});
 return <form action={action}><input type="hidden" name="organization_id" value={org}/><input type="hidden" name="domain_id" value={id}/>
  <button className="btn secondary" disabled={pending}>{pending?'Checking…':'Refresh Resend status'}</button>
  {state.error&&<p className="feedback-error" role="alert">{state.error}</p>}{state.success&&<p className="feedback-success" role="status">{state.success}</p>}
 </form>;
}
export function CharisDomainUnlinkForm({org,id}:{org:string;id:string}){
 const [state,action,pending]=useActionState(removePendingCharisDomain,{});
 return <form action={action} onSubmit={e=>{if(!window.confirm('Remove this unfinished domain connection from Charis?'))e.preventDefault();}}>
  <input type="hidden" name="organization_id" value={org}/><input type="hidden" name="domain_id" value={id}/>
  <button className="btn secondary" disabled={pending}>{pending?'Removing…':'Remove unfinished connection'}</button>
  {state.error&&<p className="feedback-error" role="alert">{state.error}</p>}
 </form>;
}

export function RemoveUnusedCharisSender({org,id}:{org:string;id:string}){
 const [state,action,pending]=useActionState(removeUnusedCharisSender,{});
 return <form action={action} onSubmit={e=>{if(!window.confirm('Remove this disabled sender? Historical senders cannot be deleted.'))e.preventDefault();}}>
  <input type="hidden" name="organization_id" value={org}/><input type="hidden" name="sender_id" value={id}/>
  <button className="btn secondary" disabled={pending}>{pending?'Removing…':'Remove unused sender'}</button>
  {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}
 </form>;
}
