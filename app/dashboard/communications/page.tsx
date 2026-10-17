import Link from 'next/link';
import {redirect} from 'next/navigation';
import {Mail,MessageSquare,Send,Settings2} from 'lucide-react';
import {WorkspaceShell} from '@/components/workspace-shell';
import {supabaseServer} from '@/lib/supabase/server';
import {currentAccount} from '@/lib/auth/account';
import {canSendDirect} from '@/lib/auth/direct-send-access';
import {DirectApprovalForm} from '@/components/direct-approval-form';
import {messageStatusLabel} from '@/lib/direct/delivery-view';
export const dynamic='force-dynamic';
export const maxDuration=120;
export default async function Communications({searchParams}:{searchParams:Promise<{view?:string}>}){
 const account=await currentAccount();if(!account)redirect('/login');const org=account.workspace.id,db=await supabaseServer();
 const params=await searchParams;const archived=params.view==='archived';
 const [canSend,{data:isAdmin},{data:canManage},{data:subscriptionsAccess},{data:messages,error},{data:settings}]=await Promise.all([
  canSendDirect(org),db.rpc('charis_direct_is_admin',{p_org:org}),db.rpc('charis_direct_can_manage_history',{p_org:org}),db.rpc('charis_subscription_can',{p_org:org,p_action:'view'}),
  (archived?db.from('charis_direct_messages').select('id,title,subject,channel,purpose,status,recipient_count,created_by,created_at,archived_at,scheduled_at').eq('organization_id',org).not('archived_at','is',null):db.from('charis_direct_messages').select('id,title,subject,channel,purpose,status,recipient_count,created_by,created_at,archived_at,scheduled_at').eq('organization_id',org).is('archived_at',null)).order('created_at',{ascending:false}).limit(50),
  db.from('charis_direct_settings').select('approval_required').eq('organization_id',org).maybeSingle()
 ]);
 const canApprove=account.permissions.includes('campaigns.approve')||isAdmin===true;
 return <WorkspaceShell title="Campaigns" subtitle="Messages and delivery history" actions={canSend?<Link href="/dashboard/communications/new" className="btn"><Send size={16}/> Create Campaign</Link>:undefined}>
  <div className="direct-quicklinks"><Link href="/dashboard/communications/new"><Mail size={19}/> Compose</Link>{isAdmin&&<Link href="/admin/communications"><Settings2 size={19}/> Communication settings</Link>}
   {account.permissions.includes('templates.manage')&&<Link href={`/dashboard/templates?org=${org}`}>Design templates</Link>}
  </div>
  {(subscriptionsAccess===true||isAdmin===true)&&<p><Link href="/admin/subscriptions" className="inline-link">Email subscriptions</Link></p>}
  {settings?.approval_required&&<p className="notice">Approval is enabled in bank settings.</p>}
  <section className="panel"><div className="workspace-heading"><h2>{archived?'Archived messages':'Recent campaigns'}</h2>{canManage===true&&<Link className="btn secondary" href={archived?'/dashboard/communications':'/dashboard/communications?view=archived'}>{archived?'Active messages':'Archived'}</Link>}</div>{error&&<p role="alert" className="feedback-error">Direct message history is unavailable. Confirm SQL 047 is installed.</p>}
  {messages?.length?<div className="table-scroll"><table className="admin-table"><thead><tr><th>Message</th><th>Channel</th><th>Recipients</th><th>Status</th><th>Date</th><th>Action</th></tr></thead><tbody>
   {messages.map(m=><tr key={m.id}><td><strong>{m.title}</strong><small style={{display:'block'}}>{m.subject}</small></td><td>{m.channel==='email'?<Mail size={17}/>:<MessageSquare size={17}/>}</td><td>{m.recipient_count}</td><td><span className="status-chip">{messageStatusLabel(m.status,m.scheduled_at)}</span></td><td>{m.scheduled_at&&new Date(m.scheduled_at).getTime()>Date.now()?`Send ${new Date(m.scheduled_at).toLocaleString('en-NG',{timeZone:'Africa/Lagos'})}`:new Date(m.created_at).toLocaleString('en-NG')}</td><td><div className="actions"><Link href={`/dashboard/communications/history?id=${m.id}`}>Details</Link>{!archived&&m.status==='pending_approval'&&canApprove&&m.created_by!==account.id&&<DirectApprovalForm id={m.id}/>}</div></td></tr>)}
  </tbody></table></div>:!error&&<p className="muted">No campaigns yet. Select Create Campaign to begin.</p>}</section>
  {isAdmin===true&&<details className="panel"><summary>Previous campaign records</summary>
   <div className="actions"><Link className="btn secondary" href={`/dashboard/campaigns?org=${org}`}>Legacy Campaign Studio</Link><Link className="btn secondary" href={`/dashboard/delivery?org=${org}`}>Legacy queue</Link><Link className="btn secondary" href={`/dashboard/approvals?org=${org}`}>Legacy approvals</Link>{account.permissions.includes('service_notices.view')&&<Link className="btn secondary" href="/dashboard/communications/service">Account service notices</Link>}{account.permissions.includes('campaigns.view')&&<Link className="btn secondary" href={`/dashboard/sms?org=${org}`}>SMS communications (legacy)</Link>}</div></details>}
 </WorkspaceShell>;
}
