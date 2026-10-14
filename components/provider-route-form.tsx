'use client';
import {useActionState} from 'react';
import {saveDeliveryRoute,connectVerifiedMailjetSender,connectVerifiedBrevoSender,saveEmailMonthlyBudget} from '@/app/admin/providers/route-actions';
export type RouteSender={id:string;email:string;name:string};
export function ProviderRouteForm({provider,senders,route}:{provider:'resend'|'brevo'|'mailjet';senders:RouteSender[];route?:{sender_id:string;enabled:boolean;permission_confirmed:boolean;allowed_kind:string}}){
 const [state,submit,pending]=useActionState(saveDeliveryRoute,{});
 const canMarketing=provider==='mailjet';
 return <form action={submit} className="admin-form">
  <h3>Recipient routing</h3><input type="hidden" name="provider" value={provider}/>
  <p className="muted">Choose a sender verified by {provider}. Routing does not replace account approval, permission or suppression checks.</p>
  <label>Sender address<select name="sender_id" required defaultValue={route?.sender_id||''} disabled={pending}>
   <option value="">Choose verified sender</option>{senders.map(s=><option key={s.id} value={s.id}>{s.name} · {s.email}</option>)}
  </select></label>
  <label>Permitted message type<select name="kind" defaultValue={route?.allowed_kind|| (canMarketing?'marketing':'service')} disabled={pending}>
   <option value="service">Bank-approved service notices (separate workflow required)</option>
   {canMarketing&&<option value="marketing">Opted-in promotional campaigns</option>}
  </select></label>
  <label><input type="checkbox" name="confirmed" defaultChecked={route?.permission_confirmed||false} disabled={pending}/> I have checked this provider account permits the selected message type and its sending limits.</label>
  <label><input type="checkbox" name="enabled" defaultChecked={route?.enabled||false} disabled={pending||!senders.length}/> Include this provider in automatic routing</label>
  <button className="btn secondary" disabled={pending||!senders.length}>Save routing settings</button>
  {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}
 </form>;
}
export function MailjetSenderConnect(){
 const [state,submit,pending]=useActionState(connectVerifiedMailjetSender,{});
 return <form action={submit} className="admin-form"><h3>Connect verified Mailjet sender</h3>
  <p className="muted">Use an address already marked Active in Mailjet. This checks that address through Mailjet's API.</p>
  <label>Email address<input name="email" type="email" required placeholder="communications@yourdomain.com"/></label>
  <label>Display name<input name="name" required defaultValue="Charis Microfinance Bank"/></label>
  <label>Reply-to address<input name="reply_to" type="email" placeholder="Optional"/></label>
  <button className="btn secondary" disabled={pending}>Verify and connect</button>
  {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}
 </form>;
}

export function BrevoSenderConnect(){
 const [state,submit,pending]=useActionState(connectVerifiedBrevoSender,{});
 return <form action={submit} className="admin-form"><h3>Connect verified Brevo sender</h3>
  <p className="muted">This checks that your sender is active in Brevo and its domain is authenticated.</p>
  <label>Email address<input name="email" type="email" required placeholder="communications@yourdomain.com"/></label>
  <label>Display name<input name="name" required defaultValue="Charis Microfinance Bank"/></label>
  <label>Reply-to address<input name="reply_to" type="email" placeholder="Optional"/></label>
  <button className="btn secondary" disabled={pending}>Verify and connect</button>
  {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}
 </form>;
}

export function MonthlyEmailBudgetForm({value}:{value:number}){
 const [state,submit,pending]=useActionState(saveEmailMonthlyBudget,{});
 return <form action={submit} className="admin-form"><h3>Bank-wide monthly email limit</h3>
  <p className="muted">All provider deliveries count towards this limit, including rejected attempts. This does not purchase provider credits or enable sending.</p>
  <label>Maximum attempted sends per month<input type="number" name="monthly_limit" min={1} max={1000000} defaultValue={value} required/></label>
  <button className="btn secondary" disabled={pending}>Save monthly limit</button>
  {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}
 </form>;
}
