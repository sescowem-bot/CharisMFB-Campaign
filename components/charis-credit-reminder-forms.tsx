'use client';
import {useActionState,useEffect,useMemo,useState} from 'react';
import {createCreditReminder,transitionCreditReminder,saveCreditReminderPolicy} from '@/app/dashboard/credit-reminders/actions';
import {creditReminderPreview,DEFAULT_CREDIT_REMINDER} from '@/lib/credit-reminder-format';
export type SelectableLoan={id:string;customerId:string;reference:string;customer:string;first_name:string;due:string;outstanding:number;email:boolean;sms:boolean};
export function CreditReminderComposer({loans,initialLoan,initialKey}:{loans:SelectableLoan[];initialLoan?:string;initialKey:string}){
 const [result,action,pending]=useActionState(createCreditReminder,{});
 const [selected,setSelected]=useState<string[]>(()=>loans.some(l=>l.id===initialLoan&&l.sms)?[initialLoan!]:[]);
 const [channel,setChannel]=useState<'email'|'sms'>('sms');
 const [message,setMessage]=useState(DEFAULT_CREDIT_REMINDER);
 const [key,setKey]=useState(initialKey);
 useEffect(()=>{if(result.success){setKey(crypto.randomUUID());setSelected([]);}},[result]);
 const available=useMemo(()=>loans.filter(l=>channel==='email'?l.email:l.sms),[channel,loans]);
 const one=loans.find(l=>l.id===selected[0]);
 return <form action={action} className="admin-form">
  <input type="hidden" name="key" value={key}/>
  <label>Delivery channel<select name="channel" value={channel} onChange={e=>{setChannel(e.target.value as 'email'|'sms');setSelected([]);setKey(crypto.randomUUID());}}><option value="sms">SMS</option><option value="email">Email</option></select></label>
  <label>Internal reminder title / email subject<input name="subject" required minLength={3} maxLength={140} defaultValue="Repayment reminder — Charis Microfinance Bank"/></label>
  <fieldset className="credit-selection"><legend>Select loan customers ({selected.length} selected, maximum 50; one loan per customer in each batch)</legend>
   <div className="actions"><button type="button" className="btn secondary" onClick={()=>{const customers=new Set<string>();setSelected(available.filter(x=>{if(customers.has(x.customerId))return false;customers.add(x.customerId);return true;}).slice(0,50).map(x=>x.id));setKey(crypto.randomUUID());}}>Select eligible shown</button><button type="button" className="btn secondary" onClick={()=>{setSelected([]);setKey(crypto.randomUUID());}}>Clear selection</button></div>
   <div className="table-scroll"><table className="admin-table"><thead><tr><th>Select</th><th>Customer</th><th>Loan reference</th><th>Outstanding</th><th>Due date</th><th>Channel</th></tr></thead><tbody>{loans.map(l=>{const valid=channel==='email'?l.email:l.sms;const alreadySelected=selected.some(id=>id!==l.id&&loans.find(x=>x.id===id)?.customerId===l.customerId);return <tr key={l.id}><td><input aria-label={`Select loan ${l.reference}`} type="checkbox" name="loans" value={l.id} disabled={!valid||alreadySelected||(!selected.includes(l.id)&&selected.length>=50)} checked={selected.includes(l.id)} onChange={e=>{setSelected(prev=>e.target.checked?[...prev,l.id]:prev.filter(x=>x!==l.id));setKey(crypto.randomUUID());}}/></td><td>{l.customer}</td><td>{l.reference}</td><td>₦{l.outstanding.toLocaleString('en-NG',{minimumFractionDigits:2})}</td><td>{l.due}</td><td>{valid?'Available':'No destination'}</td></tr>})}</tbody></table></div>
  </fieldset>
  <label>Customer reminder message<textarea name="message" minLength={15} maxLength={800} required rows={6} value={message} onChange={e=>{setMessage(e.target.value);setKey(crypto.randomUUID());}}/></label>
  <p className="muted">Available merge fields: <code>{'{{first_name}}'}</code>, <code>{'{{loan_reference}}'}</code>, <code>{'{{outstanding}}'}</code>, <code>{'{{due_date}}'}</code>, <code>{'{{bank_name}}'}</code>. Do not include PINs, BVNs or confidential account identifiers.</p>
  {one&&<div className="notice"><strong>Preview for first selected customer (not sent)</strong><p style={{whiteSpace:'pre-wrap'}}>{creditReminderPreview(message,{first_name:one.first_name,loan_reference:one.reference,outstanding:one.outstanding,due_date:one.due})}</p></div>}
  <label className="credit-confirm"><input type="checkbox" name="reconciled" value="yes" required/> I have checked the selected outstanding balances and repayment information against the bank’s authorised core records.</label>
  <button className="btn" disabled={!selected.length||pending} type="submit">{pending?'Saving draft…':'Create reminder draft'}</button>
  {result.error&&<p role="alert" className="feedback-error">{result.error}</p>}{result.success&&<p role="status" className="feedback-success">{result.success}</p>}
  {!available.length&&<p className="muted">No eligible loans with a contact destination for this channel are shown. Use filters or update authorised customer records.</p>}
 </form>;
}
export function CreditReminderAction({id,decision}:{id:string;decision:'submit'|'approve'|'reject'|'hold'|'cancel'}){
 const [state,action,pending]=useActionState(transitionCreditReminder,{});
 const labels={submit:'Submit for review',approve:'Approve reminder',reject:'Request corrections',hold:'Prepare held delivery',cancel:'Cancel draft'};
 return <form action={action} className="admin-form" style={{maxWidth:360}}><input type="hidden" name="id" value={id}/><input type="hidden" name="decision" value={decision}/>
  {(decision==='reject'||decision==='approve')&&<label>Review note<textarea name="note" rows={2} maxLength={500} required={decision==='reject'} placeholder={decision==='reject'?'Explain required corrections':'Optional decision note'}/></label>}
  <button className={decision==='reject'||decision==='cancel'?'btn secondary':'btn'} disabled={pending}>{pending?'Updating…':labels[decision]}</button>
  {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}
 </form>;
}
export function CreditReminderPolicyForm({mode,limit}:{mode:string;limit:number}){
 const [state,action,pending]=useActionState(saveCreditReminderPolicy,{});
 return <form action={action} className="admin-form">
  <label>Review policy<select name="mode" defaultValue={mode}><option value="independent">Independent approval required (recommended)</option><option value="authorised_direct">Allow separately authorised staff to approve their own batches</option></select></label>
  <label>Daily limit of held reminder recipients<input type="number" name="limit" min={1} max={500} defaultValue={limit} required/></label>
  <p className="muted">Self-approval is allowed only when the policy is enabled <strong>and</strong> the staff member has both Review and Direct Approval permissions. No setting here enables live sending.</p>
  <button className="btn" disabled={pending}>{pending?'Saving…':'Save credit reminder policy'}</button>
  {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}
 </form>;
}
