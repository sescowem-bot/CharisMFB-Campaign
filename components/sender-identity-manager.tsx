'use client';
import {useActionState} from 'react';
import {saveSenderIdentity,disableSenderIdentity,deleteSenderIdentity} from '@/app/admin/providers/sender-actions';
type Sender={id:string;provider:'sendbyte'|'resend'|'brevo';from_email:string;from_name:string;reply_to:string|null;is_active:boolean;domain:string};
function SenderForm({sender}:{sender?:Sender}){
 const [state,action,pending]=useActionState(saveSenderIdentity,{});
 return <form action={action} className="admin-form">
  {sender&&<input type="hidden" name="sender_id" value={sender.id}/>}
  <label>Provider<select name="provider" defaultValue={sender?.provider||'sendbyte'} disabled={pending||Boolean(sender)}><option value="sendbyte">SendByte</option><option value="resend">Resend</option><option value="brevo">Brevo</option></select></label>
  <label>Sender display name<input name="from_name" defaultValue={sender?.from_name||''} required maxLength={100} placeholder="Enter the sender name" disabled={pending}/></label>
  <label>Sender email address<input name="from_email" type="email" defaultValue={sender?.from_email||''} required maxLength={254} placeholder="name@your-verified-domain.com" disabled={pending}/></label>
  <label>Reply-To email<input name="reply_to" type="email" defaultValue={sender?.reply_to||''} maxLength={254} placeholder="Optional. Defaults to sender email." disabled={pending}/></label>
  <button className="btn secondary" disabled={pending}>{pending?'Checking provider…':sender?'Save sender changes':'Verify and add sender'}</button>
  <div aria-live="polite">{state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}</div>
 </form>;
}
function SenderActions({sender}:{sender:Sender}){
 const [disabledState,disable,pendingDisable]=useActionState(disableSenderIdentity,{});
 const [deletedState,remove,pendingDelete]=useActionState(deleteSenderIdentity,{});
 return <div className="actions">
  {sender.is_active&&<form action={disable}><input type="hidden" name="sender_id" value={sender.id}/><button className="btn secondary" disabled={pendingDisable}>{pendingDisable?'Disabling…':'Disable sender'}</button></form>}
  {!sender.is_active&&<form action={remove} onSubmit={e=>{if(!window.confirm('Permanently delete this unused sender address?'))e.preventDefault();}}><input type="hidden" name="sender_id" value={sender.id}/><button className="btn secondary" disabled={pendingDelete}>{pendingDelete?'Deleting…':'Delete sender'}</button></form>}
  {disabledState.error&&<p role="alert" className="feedback-error">{disabledState.error}</p>}{disabledState.success&&<p role="status" className="feedback-success">{disabledState.success}</p>}
  {deletedState.error&&<p role="alert" className="feedback-error">{deletedState.error}</p>}{deletedState.success&&<p role="status" className="feedback-success">{deletedState.success}</p>}
 </div>;
}
export function SenderIdentityManager({senders}:{senders:Sender[]}){
 return <section className="panel" style={{marginBottom:20}}>
  <div className="workspace-heading"><div><h2>Sender addresses</h2><p className="muted">Add, edit, verify, disable or remove sender identities. No email address is fixed in the application.</p></div></div>
  <details className="charis-provider-advanced" open><summary>Add a sender address</summary><SenderForm/></details>
  <div className="stack" style={{marginTop:16}}>
   {senders.length===0&&<p className="muted">No sender addresses have been connected yet.</p>}
   {senders.map(sender=><details className="sender-domain" key={sender.id}>
    <summary><strong>{sender.from_name}</strong> · {sender.from_email} <span className="status-chip">{sender.is_active?'Active':'Disabled'}</span></summary>
    <p className="muted">{sender.provider} · {sender.domain} · Reply-To: {sender.reply_to||sender.from_email}</p>
    <SenderForm sender={sender}/><SenderActions sender={sender}/>
   </details>)}
  </div>
 </section>;
}
