import Link from 'next/link';
import {redirect} from 'next/navigation';
import {Mail,Send,Settings2} from 'lucide-react';
import {WorkspaceShell} from '@/components/workspace-shell';
import {supabaseServer} from '@/lib/supabase/server';
import {currentAccount} from '@/lib/auth/account';
import {canSendDirect} from '@/lib/auth/direct-send-access';
import {CampaignHistoryTable} from '@/components/direct-delivery-history';

export const dynamic='force-dynamic';
export const maxDuration=120;
export default async function Communications({searchParams}:{searchParams:Promise<{view?:string}>}){
 const account=await currentAccount();if(!account)redirect('/login');const org=account.workspace.id,db=await supabaseServer();
 const params=await searchParams;const archived=params.view==='archived';
 const canViewEarlier=account.owner||account.admin||account.permissions.some(p=>['campaigns.view','campaigns.edit','campaigns.create','campaigns.approve'].includes(p));
 const [canSend,{data:isAdmin},{data:canManage},{data:subscriptionsAccess},{data:messages,error},{data:settings},earlier]=await Promise.all([
  canSendDirect(org),db.rpc('charis_direct_is_admin',{p_org:org}),db.rpc('charis_direct_can_manage_history',{p_org:org}),db.rpc('charis_subscription_can',{p_org:org,p_action:'view'}),
  (archived?db.from('charis_direct_messages').select('id,title,subject,channel,purpose,status,recipient_count,created_by,created_at,archived_at,scheduled_at').eq('organization_id',org).not('archived_at','is',null):db.from('charis_direct_messages').select('id,title,subject,channel,purpose,status,recipient_count,created_by,created_at,archived_at,scheduled_at').eq('organization_id',org).is('archived_at',null)).order('created_at',{ascending:false}).limit(50),
  db.from('charis_direct_settings').select('approval_required').eq('organization_id',org).maybeSingle(),
  // Legacy records have a separate approval lifecycle. Preserve their identity
  // and expose only rows permitted by existing database policies.
  (!archived&&canViewEarlier)?db.from('campaign_drafts').select('id,name,status,updated_at').eq('organization_id',org).order('updated_at',{ascending:false}).limit(12):Promise.resolve({data:[],error:null})
 ]);
 const canApprove=account.permissions.includes('campaigns.approve')||isAdmin===true;
 return <WorkspaceShell title="Campaigns" subtitle="Messages and delivery history" actions={canSend?<Link href="/dashboard/communications/new" className="btn"><Send size={16}/> Create Campaign</Link>:undefined}>
  <div className="direct-quicklinks">{isAdmin&&<Link href="/admin/communications"><Settings2 size={19}/> Communication settings</Link>}
   {account.permissions.includes('templates.manage')&&<Link href={`/dashboard/templates?org=${org}`}>Design templates</Link>}
  </div>
  {(subscriptionsAccess===true||isAdmin===true)&&<p><Link href="/admin/subscriptions" className="inline-link">Email subscriptions</Link></p>}
  {settings?.approval_required&&<p className="notice">Approval is enabled in bank settings.</p>}
  <section className="panel"><div className="workspace-heading"><h2>{archived?'Archived messages':'Recent campaigns'}</h2>{canManage===true&&<Link className="btn secondary" href={archived?'/dashboard/communications':'/dashboard/communications?view=archived'}>{archived?'Active messages':'Archived'}</Link>}</div>{error&&<p role="alert" className="feedback-error">Direct message history is unavailable. Confirm SQL 047 is installed.</p>}
  {messages?.length?<CampaignHistoryTable messages={messages} archived={archived} canApprove={canApprove} accountId={account.id}/>:
  !error&&<div className="charis-history-no-records"><Mail size={27}/><h3>No campaigns to display</h3><p>{earlier.data?.length?"New campaigns appear here. Older campaign records are available below.":"Create your first campaign to see its progress and delivery history."}</p>{canSend&&<Link className="btn" href="/dashboard/communications/new">Create Campaign</Link>}</div>}
</section>
  {!archived&&Boolean(earlier.data?.length)&&<section className="panel"><div className="workspace-heading"><h2>Earlier campaigns</h2><Link className="inline-link" href={`/dashboard/campaigns?org=${org}`}>View all</Link></div><div className="table-scroll"><table className="admin-table"><thead><tr><th>Campaign</th><th>Status</th><th>Updated</th><th>Action</th></tr></thead><tbody>{(earlier.data||[]).map(c=><tr key={c.id}><td>{c.name}</td><td><span className="status-chip">{c.status.replaceAll("_"," ")}</span></td><td>{new Date(c.updated_at).toLocaleString("en-NG",{timeZone:"Africa/Lagos"})}</td><td><Link href={`/dashboard/campaigns?org=${org}&id=${c.id}`}>View</Link></td></tr>)}</tbody></table></div></section>}
  {isAdmin===true&&<details className="panel"><summary>Previous campaign records</summary>
   <div className="actions"><Link className="btn secondary" href={`/dashboard/campaigns?org=${org}`}>Legacy Campaign Studio</Link><Link className="btn secondary" href={`/dashboard/delivery?org=${org}`}>Legacy queue</Link><Link className="btn secondary" href={`/dashboard/approvals?org=${org}`}>Legacy approvals</Link>{account.permissions.includes('service_notices.view')&&<Link className="btn secondary" href="/dashboard/communications/service">Account service notices</Link>}{account.permissions.includes('campaigns.view')&&<Link className="btn secondary" href={`/dashboard/sms?org=${org}`}>SMS communications (legacy)</Link>}</div></details>}
 </WorkspaceShell>;
}
