import {redirect} from 'next/navigation';
import {currentAccount} from '@/lib/auth/account';
import {WorkspaceShell} from '@/components/workspace-shell';
export default async function Help(){const account=await currentAccount();if(!account)redirect('/login');
 return <WorkspaceShell title="Help & workflows" org={account.workspace?.id} subtitle="How to complete everyday communication tasks in Charis.">
 <div className="admin-columns"><section className="panel"><h2>Prepare a communication</h2><p>Choose an authorised sender, select eligible recipients, prepare the message and preview it before saving.</p></section>
 <section className="panel"><h2>Review and send</h2><p>Where approval is required, submit the communication to another authorised reviewer. Approved messages can then be sent by staff with the correct permission.</p></section>
 <section className="panel"><h2>Use email templates</h2><p>Open Email templates to customise text, buttons, approved images and branded blocks. Save designs for reuse in communications.</p></section>
 <section className="panel"><h2>Manage staff access</h2><p>Administrators can invite staff, create departments, assign responsibilities and configure roles in the Administration Centre.</p></section></div>
 </WorkspaceShell>;
}
