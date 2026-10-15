'use client';
import {useActionState} from 'react';
import {dispatchHeldLoanEmail} from '@/app/dashboard/credit-reminders/dispatch-action';
export function LoanDispatchForm({holdId,enabled}:{holdId:string;enabled:boolean}){
 const [state,action,pending]=useActionState(dispatchHeldLoanEmail,{});
 return <form action={action} className="charis-loan-dispatch-form">
  <input type="hidden" name="hold_id" value={holdId}/>
  <label><input type="checkbox" name="reconciled" value="yes" required disabled={!enabled||pending}/> I verified this loan balance, customer email, purpose and bank approval immediately before sending.</label>
  <button className="btn" disabled={!enabled||pending}>{pending?'Submitting one reminder…':'Send approved email'}</button>
  {!enabled&&<p className="muted">Customer dispatch is currently disabled. Bank/provider authorisation is required.</p>}
  {state.error&&<p className="feedback-error" role="alert">{state.error}</p>}{state.success&&<p className="feedback-success" role="status">{state.success}</p>}
 </form>;
}
