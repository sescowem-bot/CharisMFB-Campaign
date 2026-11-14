'use client';
import {useActionState,useState} from 'react';
import {saveDeliveryRoute,connectVerifiedBrevoSender,connectVerifiedSendByteSender,saveEmailMonthlyBudget} from '@/app/admin/providers/route-actions';
export type RouteSender={id:string;email:string;name:string};
export function ProviderRouteForm({provider,senders,route}:{provider:'sendbyte'|'resend'|'brevo';senders:RouteSender[];route?:{sender_id:string;enabled:boolean;permission_confirmed:boolean;allowed_kind:string}}){
 const [state,submit,pending]=useActionState(saveDeliveryRoute,{});
 const canMarketing=provider==='sendbyte'||provider==='resend';
 return <form action={submit} className="admin-form"><input type="hidden" name="provider" value={provider}/>
  <label>Sender address<select name="sender_id" required defaultValue={route?.sender_id||''} disabled={pending}><option value="">Choose verified sender</option>{senders.map(s=><option key={s.id} value={s.id}>{s.name} · {s.email}</option>)}</select></label>
  <label>Message type<select name="kind" defaultValue={route?.allowed_kind||'marketing'} disabled={pending}><option value="service">Service notices</option>{canMarketing&&<option value="marketing">Customer campaigns</option>}</select></label>
  <label><input type="checkbox" name="confirmed" defaultChecked={route?.permission_confirmed||false} disabled={pending}/> I have checked this provider account permits this message type.</label>
  <label><input type="checkbox" name="enabled" defaultChecked={route?.enabled||false} disabled={pending||!senders.length}/> Enable this provider</label>
  <button className="btn secondary" disabled={pending||!senders.length}>Save</button>
  {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}
 </form>;
}
export function SendByteSenderConnect(){
 const [state,submit,pending]=useActionState(connectVerifiedSendByteSender,{});
 // Controlled values survive the server-action response, including failed saves.
 // Keep the entered address visible after success as well; never clear it automatically.
 const [email,setEmail]=useState('');
 const [name,setName]=useState('Charis Microfinance Bank');
 const [replyTo,setReplyTo]=useState('');
 return <form action={submit} className="admin-form">
  <label>Verified sending email<input name="email" type="email" required placeholder="name@your-verified-domain.com" value={email} onChange={e=>setEmail(e.target.value)} disabled={pending}/></label>
  <label>Display name<input name="name" required value={name} onChange={e=>setName(e.target.value)} disabled={pending}/></label>
  <label>Reply-to address<input name="reply_to" type="email" placeholder="Optional" value={replyTo} onChange={e=>setReplyTo(e.target.value)} disabled={pending}/></label>
  <button className="btn secondary" disabled={pending}>{pending?'Connecting…':'Connect SendByte sender'}</button>
  {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}
  {state.success&&<p role="status" className="feedback-success">{state.success}</p>}
 </form>;
}
export function BrevoSenderConnect(){
 const [state,submit,pending]=useActionState(connectVerifiedBrevoSender,{});
 return <form action={submit} className="admin-form"><label>Email address<input name="email" type="email" required placeholder="communications@charismfb.com"/></label><label>Display name<input name="name" required defaultValue="Charis Microfinance Bank"/></label><label>Reply-to address<input name="reply_to" type="email" placeholder="Optional"/></label><button className="btn secondary" disabled={pending}>Verify and connect Brevo</button>{state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}</form>;
}
export function MonthlyEmailBudgetForm({value}:{value:number}){
 const [state,submit,pending]=useActionState(saveEmailMonthlyBudget,{});
 return <form action={submit} className="admin-form"><h3>Monthly email limit</h3><label>Maximum sends per month<input type="number" name="monthly_limit" min={1} max={1000000} defaultValue={value} required/></label><button className="btn secondary" disabled={pending}>Save limit</button>{state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p className="feedback-success">{state.success}</p>}</form>;
}
