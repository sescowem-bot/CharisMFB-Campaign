'use client';
import {useActionState} from 'react';
import {sendBrevoStaffCheck} from '@/app/admin/providers/brevo-staff-action';
export function BrevoStaffCheck({configured}:{configured:boolean}){
 const [state,action,pending]=useActionState(sendBrevoStaffCheck,{});
 return <form action={action} className="admin-form">
  <h3>Check real delivery to bank staff</h3>
  <p className="muted">Sends one real email only to the authorised staff mailbox configured by the administrator in Vercel. It never includes customer data. A 15-minute cooldown prevents repeated sending.</p>
  <button className="btn secondary" disabled={!configured||pending}>{pending?'Sending staff email…':'Send one Brevo staff email'}</button>
  {!configured&&<p role="status" className="muted">Configure BREVO_STAFF_TEST_EMAIL in Vercel Production before using this action.</p>}
  {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}
 </form>;
}
