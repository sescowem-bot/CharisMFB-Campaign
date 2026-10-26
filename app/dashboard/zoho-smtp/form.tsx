'use client';
import {useActionState} from 'react';
import {CheckCircle2,ShieldCheck,PlugZap} from 'lucide-react';
import {checkMyZohoSmtp} from './actions';

export function MyZohoSmtpForm({ready,ownsMailbox}:{ready:boolean;ownsMailbox:boolean}){
 const [state,action,pending]=useActionState(checkMyZohoSmtp,{});
 return <form action={action} className="admin-form">
  <div className="workspace-heading">
   <div><h2>Test my Zoho SMTP connection</h2><p className="muted">Checks your mailbox login only. No customer email or marketing campaign is sent.</p></div>
   <PlugZap size={23}/>
  </div>
  <button type="submit" className="btn" disabled={!ready||!ownsMailbox||pending}>{pending?'Checking secure connection…':'Verify my SMTP connection'}</button>
  {!ready&&<p className="muted">The project administrator must configure ZOHO_SMTP_HOST, ZOHO_SMTP_PORT, ZOHO_SMTP_USER, ZOHO_SMTP_APP_PASSWORD, and ZOHO_SMTP_TEST_ENABLED in Vercel first.</p>}
  {ready&&!ownsMailbox&&<p className="muted">The Zoho account configured for this test does not match the email of your Charis sign-in.</p>}
  {state.success&&<p role="status" className="feedback-success"><CheckCircle2 size={15}/> {state.success}</p>}
  {state.error&&<p role="alert" className="feedback-error"><ShieldCheck size={15}/> {state.error}</p>}
 </form>;
}
