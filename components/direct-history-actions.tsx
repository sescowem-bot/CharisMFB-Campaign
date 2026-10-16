'use client';
import {useActionState} from 'react';
import {manageDirectHistory} from '@/app/dashboard/communications/history/actions';
export function DirectHistoryActions({id,status,archived}:{id:string;status:string;archived:boolean}){
 const [state,submit,pending]=useActionState(manageDirectHistory,{});
 const action=archived?'restore':status==='pending_approval'?'delete_unsent':'archive';
 if(!archived&&!['pending_approval','completed','paused','cancelled'].includes(status))return null;
 const label=action==='delete_unsent'?'Delete unsent draft':action==='restore'?'Restore':'Archive';
 return <form action={submit} onSubmit={e=>{
  if(!window.confirm(action==='delete_unsent'?'Permanently delete this unsent draft? This cannot be undone.':'Confirm '+label.toLowerCase()+' for this communication?'))e.preventDefault();
 }} className="admin-form">
  <input type="hidden" name="id" value={id}/><input type="hidden" name="action" value={action}/>
  <button className="btn secondary" disabled={pending}>{pending?'Saving…':label}</button>
  {state.error&&<p className="feedback-error" role="alert">{state.error}</p>}
  {state.success&&<p className="feedback-success" role="status">{state.success}</p>}
 </form>;
}
