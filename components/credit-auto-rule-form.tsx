'use client';
import {useActionState,useState} from 'react';
import {saveCreditAutoRules} from '@/app/dashboard/credit-reminders/automation-actions';

export function CreditAutoRuleForm({enabled,offsets,channel,maxDaily}:{enabled:boolean;offsets:number[];channel:'email'|'sms';maxDaily:number}){
 const [result,action,pending]=useActionState(saveCreditAutoRules,{});
 const [active,setActive]=useState(enabled);
 return <form action={action} className="admin-form" style={{maxWidth:680}}>
  <label className="credit-confirm"><input type="checkbox" name="enabled" checked={active} onChange={e=>setActive(e.target.checked)}/> Enable automatic due-date detection</label>
  <label>Reminder days <input name="offsets" required defaultValue={offsets.join(', ')} placeholder="4, 3, 0" maxLength={50}/>
   <small className="muted">Comma-separated: 4 = four days before, 0 = due date, -1 = one day overdue.</small>
  </label>
  <label>Channel <select name="channel" defaultValue={channel}><option value="email">Email</option><option value="sms">SMS</option></select></label>
  <label>Daily suggestion limit <input type="number" name="max_daily" min={1} max={200} defaultValue={maxDaily} required/></label>
  <button className="btn" disabled={pending}>{pending?'Saving…':'Save reminder rules'}</button>
  {result.error&&<p role="alert" className="feedback-error">{result.error}</p>}
  {result.success&&<p role="status" className="feedback-success">{result.success}</p>}
  <p className="muted">Automation prepares reminders for review; it never sends messages automatically.</p>
 </form>;
}
