import Link from 'next/link';
import {redirect} from 'next/navigation';
import {WorkspaceShell} from '@/components/workspace-shell';
import {currentAccount} from '@/lib/auth/account';
import {currentVerifiedUser} from '@/lib/auth/current-user';
import {charisOrgId} from '@/lib/bank';
import {supabaseServer} from '@/lib/supabase/server';
import {zeptoNotificationBatchReady} from '@/lib/email/zeptomail-notifications';
import {ZeptoChecks} from './forms';
import './style.css';

export const dynamic='force-dynamic';

export default async function ZeptoMailPage(){
 const [account,user]=await Promise.all([currentAccount(),currentVerifiedUser()]);
 if(!user)redirect('/login');
 if(!account||!user.email||!user.email_confirmed_at||
    account.workspace.id!==charisOrgId()||!account.providerAdmin)redirect('/dashboard');

 const db=await supabaseServer();
 const {data:allowed,error:accessError}=await db.rpc('charis_direct_can_send',{p_org:account.workspace.id});
 const canSend=account.providerAdmin&&!accessError&&allowed===true;
 if(!account.owner&&!canSend)redirect('/dashboard');

 const sender=process.env.ZEPTOMAIL_FROM_EMAIL||'';
 const configured=Boolean(sender&&process.env.ZEPTOMAIL_SMTP_PASSWORD);
 const testEnabled=process.env.ZEPTOMAIL_TEST_ENABLED==='true';
 // Route customer notifications through the unified campaign composer.
 // Never expose the legacy disabled one-recipient Send button.
 const {error:schemaError}=await db.from('charis_direct_messages')
  .select('zepto_event_reference',{head:true,count:'exact'}).limit(0);
 const campaignsReady=canSend&&configured&&zeptoNotificationBatchReady()&&!schemaError;

 return <WorkspaceShell title="Zoho email service" subtitle="Manage the bank email connection and send notifications through Create Campaign.">
  <section className="panel charis-zepto-overview">
   <h2>Charis customer notifications</h2>
   <p>Send a notification to one customer or a selected group from one place. Charis manages the recipients and delivery history; Zoho delivers each email privately.</p>
   <div className="charis-zepto-sender"><span>Bank sending address</span><strong>{sender||'Not yet configured'}</strong></div>
   <div className="actions">
    {canSend&&<Link className="btn" href="/dashboard/communications/new">Create notification campaign</Link>}
    <Link className="btn secondary" href="/dashboard/communications">View campaigns and delivery results</Link>
   </div>
   {!campaignsReady&&<p className="muted" role="status">
    The bank notification service is not active yet. You can prepare your message, but Zoho delivery will only be available after the connection and sending setup are completed.
   </p>}
  </section>

  <details className="panel charis-zepto-settings">
   <summary><strong>Connection settings and test email</strong></summary>
   <p className="muted">Use these controls to check the bank email service. They do not send messages to customers.</p>
   <ZeptoChecks ready={configured} testEnabled={testEnabled} testEmail={user.email}/>
   {!configured&&<p className="muted">The bank email connection needs to be completed by an administrator.</p>}
   <p><Link href="https://zeptomail.zoho.com">Open Zoho ZeptoMail</Link></p>
  </details>

  <section className="panel">
   <h2>How notification sending works</h2>
   <p className="muted">Create the message, select eligible customers, preview it and confirm once. The delivery queue processes them in controlled groups of up to 50 and records each outcome.</p>
   <p className="muted">Zoho ZeptoMail is for genuine customer-specific bank notifications, such as account alerts and loan reminders, not advertisements or general newsletters.</p>
  </section>
 </WorkspaceShell>;
}
