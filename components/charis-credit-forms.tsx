'use client';
import {useActionState} from 'react';
import {recordRepayment,registerLoan} from '@/app/dashboard/loans/actions';
export type CustomerOption={id:string;name:string};
export function LoanForm({customers}:{customers:CustomerOption[]}){
 const [state,action,pending]=useActionState(registerLoan,{});
 return <form action={action} className="admin-form">
  <label>Customer<select name="contact" required defaultValue=""><option value="" disabled>Select an authorised customer</option>{customers.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
  <label>Loan account reference<input name="reference" required minLength={3} maxLength={64} placeholder="Unique core banking reference"/></label>
  <label>Principal (₦)<input name="principal" type="number" inputMode="decimal" required min="0.01" step="0.01" placeholder="0.00"/></label>
  <label>Total contracted amount due (₦)<input name="total_due" type="number" inputMode="decimal" required min="0.01" step="0.01" placeholder="Including agreed charges"/></label>
  <label>Disbursement date<input type="date" required name="disbursed"/></label>
  <label>Final repayment due date<input type="date" required name="due"/></label>
  <label>Internal notes<textarea name="notes" maxLength={1000} placeholder="Optional account information; do not include passwords or credentials"/></label>
  <button className="btn" disabled={pending||!customers.length}>{pending?'Saving…':'Register loan'}</button>
  {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}
  {state.success&&<p role="status" className="feedback-success">{state.success}</p>}
  {!customers.length&&<p className="muted">Search for an authorised customer before registering a loan.</p>}
 </form>;
}
export function RepaymentForm({loanId,disabled}:{loanId:string;disabled?:boolean}){
 const [state,action,pending]=useActionState(recordRepayment,{});
 return <form className="admin-form" action={action}>
  <input name="loan" type="hidden" value={loanId}/>
  <label>Amount received (₦)<input name="amount" required min="0.01" type="number" step="0.01" inputMode="decimal" placeholder="0.00"/></label>
  <label>Payment date<input name="paid" type="date" required defaultValue={new Date().toISOString().slice(0,10)}/></label>
  <label>Receipt or transaction reference<input name="receipt" required minLength={3} maxLength={100} placeholder="Unique payment reference"/></label>
  <label>Notes<textarea name="notes" maxLength={500}/></label>
  <button className="btn" disabled={pending||disabled}>{pending?'Posting…':'Record repayment'}</button>
  {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}
  {state.success&&<p role="status" className="feedback-success">{state.success}</p>}
 </form>;
}
