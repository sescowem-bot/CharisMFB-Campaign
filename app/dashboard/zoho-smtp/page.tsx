import './manual.css';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import {currentAccount} from '@/lib/auth/account';
import {currentVerifiedUser} from '@/lib/auth/current-user';
import {mailbox} from '@/lib/email/validation';
import {WorkspaceShell} from '@/components/workspace-shell';
import {MyZohoSmtpForm} from './form';
import {ZohoSelfTestForm,ZohoManualForm} from './manual-form';
import {randomUUID} from 'node:crypto';
export const dynamic='force-dynamic';
export default async function MyZohoMailTest(){
 const [account,user]=await Promise.all([currentAccount(),currentVerifiedUser()]);
 if(!user)redirect('/login');
 if(!account)redirect('/dashboard');
 const email=user.email||'';
 const smtpEmail=process.env.ZOHO_SMTP_USER||'';
 let ownsMailbox=false;
 try{ownsMailbox=Boolean(email&&smtpEmail&&mailbox(email)===mailbox(smtpEmail));}catch{/* Keep route usable if a mailbox environment variable is invalid. */}
 const ready=Boolean(process.env.ZOHO_SMTP_TEST_ENABLED==='true'&&process.env.ZOHO_SMTP_HOST&&
  process.env.ZOHO_SMTP_APP_PASSWORD&&process.env.ZOHO_SMTP_USER);
 return <WorkspaceShell title="Zoho business mail" subtitle="Test your mailbox and send individual client correspondence manually">
  <section className="panel">
   <h2>Send with my company email</h2>
   <p className="muted">Signed in as <strong>{email}</strong>. You can test your own Zoho SMTP without being the Zoho organisation super administrator, as long as its SMTP access is permitted.</p>
   <p className="muted">Use the exact outgoing server shown in your Zoho mailbox’s SMTP tab. Do not enter or share your normal password here.</p>
   <p><Link href="https://accounts.zoho.com/home#security" target="_blank">Manage Zoho app-specific passwords</Link></p>
  </section>
  <section className="panel"><MyZohoSmtpForm ready={ready} ownsMailbox={ownsMailbox}/></section>
  <section className="panel"><ZohoSelfTestForm enabled={ready&&ownsMailbox}/></section>
  <section className="panel"><ZohoManualForm ready={ready&&ownsMailbox}
    enabled={process.env.ZOHO_SMTP_MANUAL_CLIENT_ENABLED==='true'} sender={email} nonce={randomUUID()}/></section>
  <section className="panel">
   <h2>What happens when I send?</h2>
   <p className="muted">Verify checks your connection without sending. The self-test sends one email to you. The client composer sends one email only after you confirm its recipient and content.</p>
   <p className="muted">Zoho Mail is for normal one-to-one business correspondence. Bulk messages, automated alerts and newsletters must use an appropriate sending service.</p>
   <p><Link href="/dashboard">Return to dashboard</Link></p>
  </section>
 </WorkspaceShell>;
}
