import Link from 'next/link';
import {redirect} from 'next/navigation';
import {currentAccount} from '@/lib/auth/account';
import {WorkspaceShell} from '@/components/workspace-shell';
import {SendgridCheckForm} from './check-form';
export const dynamic='force-dynamic';
export default async function SendgridSetup(){
 const account=await currentAccount();if(!account)redirect('/login');
 if(!account.providerAdmin)redirect('/dashboard');
 const configured=Boolean(process.env.SENDGRID_API_KEY&&process.env.SENDGRID_FROM_EMAIL);
 return <WorkspaceShell admin title="SendGrid setup" subtitle="Verify your bank's email identity without enabling live delivery.">
  <section className="panel">
   <h2>Connection status</h2>
   <p>{configured?'Server configuration present; provider identity not yet verified.':'Add SENDGRID_API_KEY and SENDGRID_FROM_EMAIL in Vercel to configure this service.'}</p>
   <p className="muted">Promotional campaigns require a separate opt-in list, Marketing Single Sends integration, unsubscribe synchronisation and provider approval. Mail Send API tests are not proof of marketing capacity.</p>
   <p><Link href="/admin/providers">Back to email providers</Link></p>
  </section>
  <SendgridCheckForm/>
 </WorkspaceShell>;
}
