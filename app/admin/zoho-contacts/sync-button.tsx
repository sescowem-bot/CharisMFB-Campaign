'use client';

import {useActionState} from 'react';
import {syncZohoContactsForm} from './actions';

export function ZohoSyncButton(){
 const [state,action,pending]=useActionState(syncZohoContactsForm,null);
 return <div>
  <form action={action}>
   <button className="btn" type="submit" disabled={pending} aria-busy={pending}>
    {pending?'Synchronising Zoho contacts…':'Synchronise Zoho contacts'}
   </button>
  </form>
  {state&&<p className={state.success?'feedback-success':'feedback-error'} role={state.success?'status':'alert'} aria-live="polite">{state.message}</p>}
 </div>;
}
