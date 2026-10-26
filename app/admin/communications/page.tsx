import Link from 'next/link';
import {redirect} from 'next/navigation';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
import {DirectSettingsForm,DirectStaffForm,DirectHistoryStaffForm} from '@/components/direct-admin-forms';
export const dynamic='force-dynamic';
export default async function CommunicationSettings(){
 const account=await currentAccount();if(!account)redirect('/login');const org=account.workspace.id,db=await supabaseServer();
 const {data:allowed,error:permissionError}=await db.rpc('charis_direct_is_admin',{p_org:org});if(permissionError||!allowed)redirect('/admin');
 const [s,team,rules]=await Promise.all([
  db.from('charis_direct_settings').select('approval_required,email_enabled,sms_enabled,max_recipients').eq('organization_id',org).maybeSingle(),
  db.rpc('charis_access_staff_list',{p_org:org}),
  db.from('charis_direct_staff_rules').select('user_id,can_send,can_manage_history').eq('organization_id',org)
 ]);
 return <WorkspaceShell title="Communication settings" subtitle="Sending, providers and team access." actions={<Link className="btn secondary" href="/dashboard/communications">Back to communications</Link>}>
 {s.error||!s.data?<p className="feedback-error" role="alert">Communication settings are missing. Apply SQL 047 before using this page.</p>:<DirectSettingsForm settings={s.data}/>}
 <section className="panel"><h2>Email preferences</h2><p className="muted">View opt-outs, send verification links and assign staff permissions.</p><Link className="btn secondary" href="/admin/subscriptions">Manage email subscriptions</Link></section>
 <section className="panel"><h2>Email providers</h2><p className="muted">Manage Resend, Brevo, Mailjet and SendGrid from one email provider page. Select a verified sender and see which services are available for Charis communications.</p>
 <Link className="btn secondary" href="/admin/providers">Manage email providers</Link></section>
 <section className="panel">{team.error?<p role="alert" className="feedback-error">Staff directory could not be loaded.</p>:<><DirectStaffForm staff={(Array.isArray(team.data)?team.data:[]).map((u:{id:string;email:string})=>({id:u.id,email:u.email}))} rules={rules.data||[]}/><DirectHistoryStaffForm staff={(Array.isArray(team.data)?team.data:[]).map((u:{id:string;email:string})=>({id:u.id,email:u.email}))} rules={rules.data||[]}/></>}</section>
 </WorkspaceShell>;
}
