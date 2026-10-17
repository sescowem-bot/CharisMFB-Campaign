'use client';
import {useActionState} from 'react';
import {cancelScheduledCampaign} from '@/app/dashboard/communications/actions';
export function CancelScheduledCampaign({id}:{id:string}){
 const [state,action,pending]=useActionState(cancelScheduledCampaign,{});
 return <form action={action} className="actions"><input type="hidden" name="message_id" value={id}/>
 <button type="submit" className="btn secondary" disabled={pending} onClick={e=>{if(!window.confirm('Cancel this unsent scheduled campaign?'))e.preventDefault();}}>{pending?'Cancelling…':'Cancel schedule'}</button>
 {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}
 </form>;
}
