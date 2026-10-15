'use client';
import {useActionState,useState} from 'react';
import {createServiceNotice,submitServiceNotice,reviewServiceNotice,updateServiceNotice} from '@/app/dashboard/communications/service/actions';
type Client={id:string;name:string;email?:string|null;phone?:string|null};
export function NoticeComposer({customers,loanOptions,prefillCustomer,prefillLoan}:{customers:Client[];loanOptions:{id:string;contact_id:string;loan_reference:string}[];prefillCustomer?:string;prefillLoan?:string}){
 const [state,action,pending]=useActionState(createServiceNotice,{});
 const [selectedCustomer,setSelectedCustomer]=useState(prefillCustomer||'');
 return <form action={action} className="admin-form">
  <label>Customer<select name="contact" required value={selectedCustomer} onChange={e=>setSelectedCustomer(e.target.value)}><option value="" disabled>Choose customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}{c.email?` · ${c.email}`:''}</option>)}</select></label>
  <label>Related loan (optional)<select name="loan" defaultValue={prefillLoan||''}><option value="">General account notice</option>{loanOptions.filter(l=>l.contact_id===selectedCustomer).map(l=><option value={l.id} key={l.id}>{l.loan_reference}</option>)}</select></label>
  <label>Channel<select name="channel" required><option value="email">Email</option><option value="sms">SMS</option></select></label>
  <label>Subject<input required name="subject" minLength={3} maxLength={140} placeholder="Reason for contacting this customer"/></label>
  <label>Customer message<textarea name="message" minLength={10} maxLength={1000} required rows={5} placeholder="Use professional, respectful language. Avoid passwords, PINs and unnecessary account details."/></label>
  <button className="btn" disabled={pending||!customers.length}>{pending?'Saving…':'Save account notice'}</button>
  {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}
 </form>;
}
export function SubmitNotice({id}:{id:string}){
 const [state,action,pending]=useActionState(submitServiceNotice,{});
 return <form action={action} className="admin-form"><input type="hidden" name="id" value={id}/><button className="btn secondary" disabled={pending}>{pending?'Submitting…':'Submit for review'}</button>{state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}</form>;
}
export function ReviewNotice({id}:{id:string}){
 const [state,action,pending]=useActionState(reviewServiceNotice,{});
 return <form action={action} className="admin-form"><input type="hidden" name="id" value={id}/><label>Review comment<textarea name="note" maxLength={500} placeholder="Explain any changes required"/></label><div className="actions"><button className="btn" type="submit" name="decision" value="approve" disabled={pending}>Approve draft</button><button className="btn secondary" type="submit" name="decision" value="reject" disabled={pending}>Request changes</button></div>{state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}</form>;
}

export function EditNotice({notice}:{notice:{id:string;channel:string;subject:string;message:string}}){
 const [state,action,pending]=useActionState(updateServiceNotice,{});
 return <details><summary>Edit this draft</summary><form action={action} className="admin-form">
  <input type="hidden" name="id" value={notice.id}/>
  <label>Channel<select name="channel" defaultValue={notice.channel}><option value="email">Email</option><option value="sms">SMS</option></select></label>
  <label>Subject<input name="subject" minLength={3} maxLength={140} required defaultValue={notice.subject}/></label>
  <label>Message<textarea name="message" minLength={10} maxLength={1000} required rows={5} defaultValue={notice.message}/></label>
  <button className="btn secondary" disabled={pending}>{pending?'Saving…':'Save changes'}</button>
  {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}
 </form></details>;
}
