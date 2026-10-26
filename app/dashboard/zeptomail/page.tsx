import {randomUUID} from 'node:crypto';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {WorkspaceShell} from '@/components/workspace-shell';
import {currentAccount} from '@/lib/auth/account';
import {currentVerifiedUser} from '@/lib/auth/current-user';
import {charisOrgId} from '@/lib/bank';
import {supabaseServer} from '@/lib/supabase/server';
import {ZeptoChecks,ZeptoNoticeComposer} from './forms';
import './style.css';
export const dynamic='force-dynamic';
export default async function ZeptoMailPage(){
 const [account,user]=await Promise.all([currentAccount(),currentVerifiedUser()]);
 if(!user)redirect('/login');
 if(!account||account.workspace.id!==charisOrgId()||!account.providerAdmin)redirect('/dashboard');
 const db=await supabaseServer();
 const {data:allowed}=await db.rpc('charis_direct_can_send',{p_org:account.workspace.id});
 if(allowed!==true)redirect('/dashboard');
 const sender=process.env.ZEPTOMAIL_FROM_EMAIL||'';
 const ready=Boolean(sender&&process.env.ZEPTOMAIL_SMTP_PASSWORD);
 const testEnabled=process.env.ZEPTOMAIL_TEST_ENABLED==='true';
 const enabled=process.env.ZEPTOMAIL_TRANSACTIONAL_ENABLED==='true';
 return <WorkspaceShell title="ZeptoMail — Transactional Email" subtitle="Bank service notifications using the approved ZeptoMail Mail Agent">
  <section className="panel"><h2>Connect ZeptoMail for Charis</h2>
   <p className="muted">ZeptoMail uses a Mail Agent and separate SMTP credentials from your normal Zoho Mail login. Test the Mail Agent first, then send customer-specific service messages. Bulk announcements and marketing should use the Campaign Centre&apos;s approved bulk providers.</p>
   <p className="muted">Configuration: {ready?'Mail Agent credentials are present (not yet verified).':'Mail Agent is not configured in Vercel.'}</p>
   {!ready&&<p className="muted" role="status">Ask the project administrator to configure ZEPTOMAIL_FROM_EMAIL, ZEPTOMAIL_SMTP_USERNAME, ZEPTOMAIL_SMTP_PASSWORD, ZEPTOMAIL_SMTP_PORT and ZEPTOMAIL_TEST_ENABLED in Vercel. Do not paste credentials into this page.</p>}
   <p><Link href="https://zeptomail.zoho.com">Open ZeptoMail Mail Agents</Link></p>
  </section>
  <section className="panel"><ZeptoChecks ready={ready} testEnabled={testEnabled}/></section>
  <section className="panel"><ZeptoNoticeComposer sender={sender} nonce={randomUUID()} ready={ready}
   enabled={enabled}/></section>
  <section className="panel"><h2>Bank usage rules</h2><p className="muted">
   An account notification, loan reminder, receipt or response to a particular customer request is permitted when tied to a real event. ZeptoMail must not be used for unsolicited awareness campaigns, generic newsletters or promotional bulk emails. The initial safe limit is 20 individual notices per staff member per day, with a one-minute gap.</p>
   <p><Link href="/dashboard/communications/new">Go to Create Campaign for general announcements</Link></p>
  </section>
 </WorkspaceShell>;
}
