import Link from 'next/link';
import {redirect} from 'next/navigation';
import {WorkspaceShell} from '@/components/workspace-shell';
import {CreditReminderPolicyForm} from '@/components/charis-credit-reminder-forms';
import {CreditAutoRuleForm} from '@/components/credit-auto-rule-form';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export default async function CreditReminderSettings(){
 const user=await currentAccount();if(!user)redirect('/login');
 if(!user.permissions.includes('credit_reminders.settings'))redirect('/dashboard');
 const org=user.workspace.id;
 const db=await supabaseServer();
 const [{data:policy,error},{data:automatic,error:autoError}]=await Promise.all([
  db.from('charis_credit_reminder_policy').select('approval_mode,daily_recipient_limit').eq('organization_id',org).maybeSingle(),
  db.from('charis_credit_auto_rules_056').select('enabled,offsets,channel,max_daily').eq('organization_id',org).maybeSingle()
 ]);
 return <WorkspaceShell org={org} title="Loan reminder settings" subtitle="Manage due-date checks and review permissions." actions={<Link className="btn secondary" href="/dashboard/credit-reminders">Back to reminders</Link>}>
  {error?<p role="alert" className="feedback-error">Settings unavailable. Ask IT to confirm Migration 032 before changing permissions.</p>:
   <section className="panel"><h2>Bank approval policy</h2><CreditReminderPolicyForm mode={policy?.approval_mode||'independent'} limit={policy?.daily_recipient_limit||100}/></section>}
  <section className="panel"><h2>Due-date reminders</h2>{autoError?<p role="alert" className="feedback-error">Install database upgrade 056 before changing reminder rules.</p>:<CreditAutoRuleForm enabled={automatic?.enabled===true} offsets={Array.isArray(automatic?.offsets)?automatic.offsets:[4,3,0]} channel={automatic?.channel==='sms'?'sms':'email'} maxDaily={automatic?.max_daily||100}/>}</section>
  <section className="panel"><h2>Staff permission management</h2><p>Assign reminder preparation and review rights to authorised colleagues.</p>{user.permissions.includes('access.manage')&&<Link href="/admin/access" className="btn secondary">Roles &amp; permissions</Link>}</section>
  <p className="muted">Due-date checks create review items only. Sending requires separate approval and delivery access.</p>
 </WorkspaceShell>;
}
