 'use client';
import {useActionState} from 'react';
import {approveDirectMessage} from '@/app/dashboard/communications/actions';
export function DirectApprovalForm({id}:{id:string}){
 const [state,action,pending]=useActionState(approveDirectMessage,{});
 return <form action={action} className="direct-approve"><input type="hidden" name="message_id" value={id}/><button type="submit" className="btn secondary" disabled={pending}>{pending?'Approving…':'Approve & send'}</button>{state.error&&<small role="alert" className="feedback-error">{state.error}</small>}{state.success&&<small role="status" className="feedback-success">{state.success}</small>}</form>;
}
