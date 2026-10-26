import {redirect} from 'next/navigation';
import Link from 'next/link';
import {currentAccount} from '@/lib/auth/account';
import {currentVerifiedUser} from '@/lib/auth/current-user';
import {mailbox} from '@/lib/email/validation';
import {WorkspaceShell} from '@/components/workspace-shell';
import {MyZohoSmtpForm} from './form';
export const dynamic='force-dynamic';
export default async function MyZohoMailTest(){
 const [account,user]=await Promise.all([currentAccount(),currentVerifiedUser()]);
 if(!user)redirect('/login');
 if(!account)redirect('/dashboard');
 const email=user.email||'';
 const smtpEmail=process.env.ZOHO_SMTP_USER||'';
 const ownsMailbox=Boolean(email&&smtpEmail&&mailbox(email)===mailbox(smtpEmail));
 const ready=Boolean(process.env.ZOHO_SMTP_TEST_ENABLED==='true'&&process.env.ZOHO_SMTP_HOST&&
  process.env.ZOHO_SMTP_APP_PASSWORD&&process.env.ZOHO_SMTP_USER);
 return <WorkspaceShell title="My Zoho Mail connection" subtitle="Personal staff mailbox test, not bulk sending">
  <section className="panel">
   <h2>My bank mailbox</h2>
   <p className="muted">Signed in as <strong>{email}</strong>. You can test your own Zoho SMTP without being the Zoho organisation super administrator, as long as its SMTP access is permitted.</p>
   <p className="muted">Use the exact outgoing server shown in your Zoho mailbox’s SMTP tab. Do not enter or share your normal password here.</p>
   <p><Link href="https://accounts.zoho.com/home#security" target="_blank">Manage Zoho app-specific passwords</Link></p>
  </section>
  <section className="panel"><MyZohoSmtpForm ready={ready} ownsMailbox={ownsMailbox}/></section>
  <section className="panel">
   <h2>What this test does</h2>
   <p className="muted">Nodemailer checks whether Zoho accepts the configured credentials using a secure SMTP connection. It does not send a message and cannot be used here to broadcast to customers.</p>
   <p className="muted">To test a single message to your own inbox from your local computer, use the project’s opt-in <code>npm run check:zoho:self</code> command.</p>
   <p><Link href="/dashboard">Return to dashboard</Link></p>
  </section>
 </WorkspaceShell>;
}
