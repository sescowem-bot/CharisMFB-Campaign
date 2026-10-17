import Link from 'next/link';
import {redirect} from 'next/navigation';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
import {DirectSettingsForm,DirectProviderForm,DirectStaffForm,DirectHistoryStaffForm} from '@/components/direct-admin-forms';
export const dynamic='force-dynamic';
type Provider='resend'|'brevo'|'mailjet';
export default async function CommunicationSettings(){
 const account=await currentAccount();if(!account)redirect('/login');const org=account.workspace.id,db=await supabaseServer();
 const {data:allowed,error:permissionError}=await db.rpc('charis_direct_is_admin',{p_org:org});if(permissionError||!allowed)redirect('/admin');
 const [s,prefs,senders,domains,team,rules]=await Promise.all([
  db.from('charis_direct_settings').select('approval_required,email_enabled,sms_enabled,max_recipients').eq('organization_id',org).maybeSingle(),
  db.from('charis_direct_provider_prefs').select('provider,sender_id,enabled,priority').eq('organization_id',org),
  db.from('sender_identities').select('id,domain_id,from_name,from_email,is_active').eq('organization_id',org),
  db.from('sending_domains').select('id,provider,verification_status,charis_connected').eq('organization_id',org),
  db.rpc('charis_access_staff_list',{p_org:org}),
  db.from('charis_direct_staff_rules').select('user_id,can_send,can_manage_history').eq('organization_id',org)
 ]);
 const domainById=new Map((domains.data||[]).map(d=>[d.id,d]));
 const choices=(provider:Provider)=>(senders.data||[]).filter(si=>si.is_active&&domainById.get(si.domain_id)?.provider===provider&&domainById.get(si.domain_id)?.verification_status==='verified'&&domainById.get(si.domain_id)?.charis_connected===true).map(si=>({id:si.id,name:si.from_name,email:si.from_email}));
 return <WorkspaceShell title="Communication settings" subtitle="Sending, providers and team access." actions={<Link className="btn secondary" href="/dashboard/communications">Back to communications</Link>}>
 {s.error||!s.data?<p className="feedback-error" role="alert">Communication settings are missing. Apply SQL 047 before using this page.</p>:<DirectSettingsForm settings={s.data}/>}
 <section className="panel"><h2>Email preferences</h2><p className="muted">View opt-outs, send verification links and assign staff permissions.</p><Link className="btn secondary" href="/admin/subscriptions">Manage email subscriptions</Link></section>
 <section className="panel"><h2>Automatic email providers</h2><p className="muted">Choose verified service senders. Charis selects an available provider automatically.</p>
 {(prefs.error||senders.error||domains.error)&&<p role="alert" className="feedback-error">Sender records could not be loaded. No sending configuration was changed.</p>}
 {!prefs.error&&!senders.error&&!domains.error&&<div className="direct-provider-grid">{(['resend','brevo','mailjet'] as Provider[]).map(p=><DirectProviderForm key={p} provider={p} senders={choices(p)} current={(prefs.data||[]).find(x=>x.provider===p)}/>)}</div>}
 <p className="notice">This setting authorises providers for genuine service notices, not marketing. Choose a provider and sender only if your provider account permits these communications. The original promotional routing settings stay unchanged.</p>
 </section>
 <section className="panel">{team.error?<p role="alert" className="feedback-error">Staff directory could not be loaded.</p>:<><DirectStaffForm staff={(Array.isArray(team.data)?team.data:[]).map((u:{id:string;email:string})=>({id:u.id,email:u.email}))} rules={rules.data||[]}/><DirectHistoryStaffForm staff={(Array.isArray(team.data)?team.data:[]).map((u:{id:string;email:string})=>({id:u.id,email:u.email}))} rules={rules.data||[]}/></>}</section>
 </WorkspaceShell>;
}
