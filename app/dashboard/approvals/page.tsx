import Link from 'next/link';
import {redirect} from 'next/navigation';
import {z} from 'zod';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
import {CampaignWorkflow} from '@/components/campaign-studio';
import {CharisStatus,CharisEmptyState,CharisSafetyNote} from '@/components/charis-ui';
export const dynamic='force-dynamic';
export default async function Approvals({searchParams}:{searchParams:Promise<{org?:string}>}){
 const {org}=await searchParams;
 if(!org||!z.string().uuid().safeParse(org).success)redirect('/dashboard');
 const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const [{data:allowed},{data:member},{data:superAdmin}]=await Promise.all([db.rpc('can_approve_campaigns',{p_org:org}),db.rpc('is_organization_member',{org}),db.rpc('is_platform_super_admin')]);
 if(!member&&!superAdmin)redirect('/dashboard');
 const {data:pending,error}=await db.from('campaign_drafts').select('id,name,subject,status,revision,updated_at,edited_by,submitted_by,eligible_at_review').eq('organization_id',org).eq('status','pending_approval').order('updated_at',{ascending:true}).limit(100);
 const {data:drafts}=await db.from('campaign_drafts').select('id,name,status').eq('organization_id',org).in('status',['draft','rejected']).limit(20);
 const {data:approved}=await db.from('campaign_drafts').select('id,name,revision,updated_at').eq('organization_id',org).eq('status','approved').order('updated_at',{ascending:false}).limit(20);
 return <WorkspaceShell org={org} title="Campaign approvals"><CharisSafetyNote>Review the message, sender and eligible audience before approving. Approvals are recorded and must be performed by a different authorised person.</CharisSafetyNote>
 {!allowed&&<div className="notice">Your account can view campaign status, but only an authorised approver can approve or reject.</div>}
 {error&&<p role="alert" className="feedback-error">Approval inbox could not be loaded. Please refresh.</p>}
 <h2>Awaiting approval ({pending?.length??0})</h2>
 {!pending?.length&&!!drafts?.length&&<div className="notice">You have {drafts.length} saved draft or rejected campaigns. Drafts do not enter the approval inbox until a creator opens them and chooses Submit for review. <Link className="inline-link" href={`/dashboard/campaigns?org=${org}`}>Open campaigns</Link>.</div>}
 {!pending?.length&&!error&&<CharisEmptyState title="Nothing to review" description="Campaigns appear here when a creator submits a saved draft for approval." href={`/dashboard/campaigns?org=${org}`} action="View campaigns"/>}
 {pending?.map(c=><section key={c.id} className="panel"><div className="workspace-heading"><div><h3>{c.name}</h3><p className="muted">Subject: {c.subject}</p></div><CharisStatus status="pending_approval"/></div>
 <p className="muted">{c.eligible_at_review??'Not yet counted'} eligible recipients · Submitted {new Date(c.updated_at).toLocaleString('en-NG')}</p>
 <Link className="btn secondary" href={`/dashboard/campaigns?org=${org}&id=${c.id}`}>Review message and recipients</Link>
 {allowed&&c.edited_by!==user.id&&c.submitted_by!==user.id?<CampaignWorkflow org={org} id={c.id} revision={c.revision} actions={['approve','reject']}/>:<p className="muted">{allowed?'You cannot approve a campaign you created or submitted. Another authorised approver must review it.':'An authorised approver must review this campaign.'}</p>}</section>)}
 <h2>Approved and ready to send</h2>{approved?.length?approved.map(c=><div className="panel" key={c.id}><strong>{c.name}</strong><p className="muted">Approved · {new Date(c.updated_at).toLocaleString('en-NG')}</p><Link className="btn" href={`/dashboard/campaigns?org=${org}&id=${c.id}`}>Open campaign and send</Link></div>):<p className="muted">No approved campaigns yet.</p>}
 </WorkspaceShell>;
}
