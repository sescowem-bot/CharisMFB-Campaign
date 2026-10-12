import Link from 'next/link';
import {redirect} from 'next/navigation';
import {z} from 'zod';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
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
 return <WorkspaceShell org={org} title="Campaign approvals"><p className="muted">Review campaigns here, approve or reject, then send from the approved campaign screen. Every action is recorded.</p>
 {!allowed&&<div className="notice">Your account can view campaign status, but only an authorised approver can approve or reject.</div>}
 {error&&<p role="alert" className="feedback-error">Approval inbox could not be loaded. Please refresh.</p>}
 <h2>Awaiting approval ({pending?.length??0})</h2>
 {!pending?.length&&!error&&<section className="panel"><p>No campaigns are awaiting approval. A campaign creator must save a draft and click Submit for approval first.</p><Link className="btn secondary" href={`/dashboard/campaigns?org=${org}`}>Open campaigns</Link></section>}
 {pending?.map(c=><section key={c.id} className="panel"><div className="workspace-heading"><div><h3>{c.name}</h3><p className="muted">Subject: {c.subject}</p></div><span className="status-chip">Pending review</span></div>
 <p className="muted">{c.eligible_at_review??'Not yet counted'} eligible recipients · Submitted {new Date(c.updated_at).toLocaleString('en-NG')}</p>
 <Link className="btn secondary" href={`/dashboard/campaigns?org=${org}&id=${c.id}`}>Review message and recipients</Link>
 {allowed&&c.edited_by!==user.id&&c.submitted_by!==user.id?<CampaignWorkflow org={org} id={c.id} revision={c.revision} actions={['approve','reject']}/>:<p className="muted">{allowed?'You cannot approve a campaign you created or submitted. Another authorised approver must review it.':'An authorised approver must review this campaign.'}</p>}</section>)}
 <h2>Approved and ready to send</h2>{approved?.length?approved.map(c=><div className="panel" key={c.id}><strong>{c.name}</strong><p className="muted">Approved · {new Date(c.updated_at).toLocaleString('en-NG')}</p><Link className="btn" href={`/dashboard/campaigns?org=${org}&id=${c.id}`}>Open campaign and send</Link></div>):<p className="muted">No approved campaigns yet.</p>}
 </WorkspaceShell>;
}
