import Link from 'next/link';
import {redirect} from 'next/navigation';
import {z} from 'zod';
import {supabaseServer} from '@/lib/supabase/server';
import {ClipboardCheck} from 'lucide-react';
import {WorkspaceShell} from '@/components/workspace-shell';
import {Callout,EmptyState,StatusBadge} from '@/components/ui';
import {CampaignWorkflow} from '@/components/campaign-studio';
export const dynamic='force-dynamic';
export default async function Approvals({searchParams}:{searchParams:Promise<{org?:string}>}){
 const {org}=await searchParams;
 if(!org||!z.string().uuid().safeParse(org).success)redirect('/dashboard');
 const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const [{data:allowed},{data:member},{data:superAdmin}]=await Promise.all([db.rpc('can_approve_campaigns',{p_org:org}),db.rpc('is_organization_member',{org}),db.rpc('is_platform_super_admin')]);
 if(!member&&!superAdmin)redirect('/dashboard');
 const {data:pending,error}=await db.from('campaign_drafts').select('id,name,subject,status,revision,updated_at,edited_by,submitted_by,eligible_at_review').eq('organization_id',org).eq('status','pending_approval').order('updated_at',{ascending:true}).limit(100);
 const {data:approved}=await db.from('campaign_drafts').select('id,name,revision,updated_at').eq('organization_id',org).eq('status','approved').order('updated_at',{ascending:false}).limit(20);
 return <WorkspaceShell org={org} title="Approvals" subtitle="Every campaign needs an independent reviewer before it can be sent. All decisions are recorded in the audit log.">
  {!allowed&&<Callout tone="warning">Your account can view campaign status, but only an authorised approver can approve or reject.</Callout>}
  {error&&<Callout tone="danger" alert>The approval inbox could not be loaded. Please refresh.</Callout>}
  <div className="page-head" style={{marginBottom:6}}><div><h2>Awaiting approval ({pending?.length??0})</h2></div></div>
  {!pending?.length&&!error&&<EmptyState icon={ClipboardCheck} title="Nothing waiting for review" text="When a campaign creator submits a draft for review, it will appear here."><Link className="btn secondary" href={`/dashboard/campaigns?org=${org}`}>Open campaigns</Link></EmptyState>}
  {pending?.map(c=><section key={c.id} className="panel"><div className="workspace-heading"><div><h3>{c.name}</h3><p className="muted" style={{margin:0}}>Subject: {c.subject}</p></div><StatusBadge status="pending_approval">Pending review</StatusBadge></div>
   <p className="muted">{c.eligible_at_review??'Not yet counted'} eligible recipients · Submitted {new Date(c.updated_at).toLocaleString('en-NG',{dateStyle:'medium',timeStyle:'short'})}</p>
   <Link className="btn secondary sm" href={`/dashboard/campaigns?org=${org}&id=${c.id}`}>Review message and recipients</Link>
   {allowed&&c.edited_by!==user.id&&c.submitted_by!==user.id?<CampaignWorkflow org={org} id={c.id} revision={c.revision} actions={['approve','reject']}/>:<p className="muted" style={{marginTop:14}}>{allowed?'You cannot approve a campaign you created or submitted. Another authorised approver must review it.':'An authorised approver must review this campaign.'}</p>}</section>)}
  <div className="page-head" style={{marginTop:30,marginBottom:6}}><div><h2>Approved and ready to send</h2></div></div>
  {approved?.length?<div className="table-scroll"><table className="admin-table"><thead><tr><th>Campaign</th><th>Approved</th><th></th></tr></thead><tbody>{approved.map(c=><tr key={c.id}><td><strong>{c.name}</strong></td><td className="muted">{new Date(c.updated_at).toLocaleString('en-NG',{dateStyle:'medium',timeStyle:'short'})}</td><td style={{textAlign:'right'}}><Link className="btn sm" href={`/dashboard/campaigns?org=${org}&id=${c.id}`}>Open and send</Link></td></tr>)}</tbody></table></div>:<p className="muted">No approved campaigns yet.</p>}
 </WorkspaceShell>;
}
