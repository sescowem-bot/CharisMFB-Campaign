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
 const account=await currentAccount();if(!account)redirect('/login');
 const org=account.workspace.id,db=await supabaseServer(),params=await searchParams,archived=params.view==='archived';
 const [canSend,{data:isAdmin},{data:canManage},{data:subscriptionsAccess},{data:messages,error},{data:settings}]=await Promise.all([
  canSendDirect(org),
  db.rpc('charis_direct_is_admin',{p_org:org}),
  db.rpc('charis_direct_can_manage_history',{p_org:org}),
  db.rpc('charis_subscription_can',{p_org:org,p_action:'view'}),
  (archived?db.from('charis_direct_messages').select('id,title,subject,channel,purpose,status,recipient_count,created_by,created_at,archived_at,scheduled_at').eq('organization_id',org).not('archived_at','is',null):db.from('charis_direct_messages').select('id,title,subject,channel,purpose,status,recipient_count,created_by,created_at,archived_at,scheduled_at').eq('organization_id',org).is('archived_at',null)).order('created_at',{ascending:false}).limit(50),
  db.from('charis_direct_settings').select('approval_required').eq('organization_id',org).maybeSingle()
 ]);
 const canApprove=account.permissions.includes('campaigns.approve')||isAdmin===true;
 return <WorkspaceShell title="Campaigns" subtitle="Create customer updates and review delivery" actions={canSend?<Link href="/dashboard/communications/new" className="btn"><Send size={16}/> Create Campaign</Link>:undefined}>
  <div className="direct-quicklinks">{isAdmin&&<Link href="/admin/communications"><Settings2 size={19}/> Communication settings</Link>}
   {account.permissions.includes('templates.manage')&&<Link href={`/dashboard/templates?org=${org}`}>Design templates</Link>}
  </div>
  {(subscriptionsAccess===true||isAdmin===true)&&<p><Link href="/admin/subscriptions" className="inline-link">Email preferences</Link></p>}
  {settings?.approval_required&&<p className="notice">Campaign approval is enabled.</p>}
  <section className="panel"><div className="workspace-heading"><h2>{archived?'Archived campaigns':'Recent campaigns'}</h2>{canManage===true&&<Link className="btn secondary" href={archived?'/dashboard/communications':'/dashboard/communications?view=archived'}>{archived?'Active campaigns':'Archived'}</Link>}</div>
   {error&&<p role="alert" className="feedback-error">Campaign history is temporarily unavailable.</p>}
   {messages?.length?<CampaignHistoryTable messages={messages} archived={archived} canApprove={canApprove} accountId={account.id}/>:
    !error&&<div className="charis-history-no-records"><Mail size={27}/><h3>No campaigns yet</h3><p>Create a customer update to see its progress and delivery results here.</p>{canSend&&<Link className="btn" href="/dashboard/communications/new">Create Campaign</Link>}</div>}
  </section>
 </WorkspaceShell>;
}
