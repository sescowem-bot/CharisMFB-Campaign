'use client';
import {useActionState} from 'react';
import {dismissCreditAutoSuggestion,scanCreditAutoSuggestions} from '@/app/dashboard/credit-reminders/automation-actions';
export function CreditAutoScan(){
 const [result,action,pending]=useActionState(scanCreditAutoSuggestions,{});
 return <form action={action} className="actions"><button className="btn secondary" disabled={pending}>{pending?'Checking…':'Check due loans'}</button>
  {result.error&&<span role="alert" className="feedback-error">{result.error}</span>}{result.success&&<span role="status" className="muted">{result.success}</span>}
 </form>;
}
export function CreditAutoDismiss({id}:{id:string}){
 const [result,action,pending]=useActionState(dismissCreditAutoSuggestion,{});
 return <form action={action}><input type="hidden" name="id" value={id}/><button className="btn secondary" disabled={pending} type="submit">Dismiss</button>
  {result.error&&<span role="alert" className="feedback-error">{result.error}</span>}</form>;
}
