import Link from 'next/link';
import {redirect} from 'next/navigation';
import {WorkspaceShell} from '@/components/workspace-shell';
import {CreditReminderPolicyForm} from '@/components/charis-credit-reminder-forms';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export default async function CreditReminderSettings(){
 const user=await currentAccount();if(!user)redirect('/login');
 if(!user.permissions.includes('credit_reminders.settings'))redirect('/dashboard');
 const org=user.workspace.id;
 const db=await supabaseServer();
 const {data:policy,error}=await db.from('charis_credit_reminder_policy').select('approval_mode,daily_recipient_limit').eq('organization_id',org).maybeSingle();
 return <WorkspaceShell org={org} title="Credit reminder approval policy" subtitle="Control which bank officers can approve and stage credit reminder batches." actions={<Link className="btn secondary" href="/dashboard/credit-reminders">Back to reminders</Link>}>
  {error?<p role="alert" className="feedback-error">Settings unavailable. Ask IT to confirm Migration 032 before changing permissions.</p>:
   <section className="panel"><h2>Bank approval policy</h2><CreditReminderPolicyForm mode={policy?.approval_mode||'independent'} limit={policy?.daily_recipient_limit||100}/></section>}
  <section className="panel"><h2>Staff permission management</h2><p>Grant preparation, review, direct approval and delivery-hold capabilities in the existing Admin Centre. Permissions and the configured bank policy are both enforced in the database. A direct reviewer requires a separate grant; turning on the policy alone does not grant access.</p>{user.permissions.includes('access.manage')&&<Link href="/admin/access" className="btn secondary">Roles &amp; permissions</Link>}</section>
  <div className="notice"><strong>Channel controls:</strong> This setting does not switch on email or SMS delivery. All credit reminder records remain held even after approval.</div>
 </WorkspaceShell>;
}
