'use client';
import {useActionState} from 'react';
import {manageContact} from '@/app/dashboard/contacts/actions';
export function ContactRowActions({org,id,archived}:{org:string;id:string;archived:boolean}){
 const [state,action,pending]=useActionState(manageContact,{});
 return <form action={action} className="contact-row-actions" onSubmit={e=>{
  const button=(e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
  if(button?.value==='delete'&&!window.confirm('Permanently delete this customer? If campaign delivery history exists, deletion will be refused and you should Archive instead.'))e.preventDefault();
 }}>
  <input type="hidden" name="organization_id" value={org}/><input type="hidden" name="contact_id" value={id}/>
  <button type="submit" name="operation" value={archived?'restore':'archive'} disabled={pending} className="btn secondary">{archived?'Restore':'Archive'}</button>
  <button type="submit" name="operation" value="delete" disabled={pending} className="btn secondary">Delete</button>
  {state.error&&<p className="feedback-error" role="alert">{state.error}</p>}
  {state.success&&<p className="feedback-success" role="status">{state.success}</p>}
 </form>;
}
