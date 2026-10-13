import Link from 'next/link';
import {redirect} from 'next/navigation';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
import {UsersRound,ListChecks,Mail,ClipboardCheck,Send,UploadCloud,BarChart3,ShieldCheck,ArrowUpRight} from 'lucide-react';

export const dynamic='force-dynamic';
export default async function Dashboard(){
 const db=await supabaseServer();
 const {data:{user}}=await db.auth.getUser();
 if(!user)redirect('/login');
 const org=process.env.SINGLE_COMPANY_ORG_ID;
 if(process.env.SINGLE_COMPANY_MODE!=='true'||!org)return <WorkspaceShell title="Workspace configuration"><p role="alert" className="notice">The Charis workspace is not configured. Set SINGLE_COMPANY_MODE and SINGLE_COMPANY_ORG_ID in your deployment environment.</p></WorkspaceShell>;
 const [{data:owner},{data:member},{data:company}]=await Promise.all([
   db.rpc('is_platform_super_admin'),
   db.from('organization_members').select('role').eq('organization_id',org).eq('user_id',user.id).maybeSingle(),
   db.from('organizations').select('name,status').eq('id',org).maybeSingle()
 ]);
 if(!company||(!member&&!owner))return <WorkspaceShell org={org} title="Access pending"><section className="panel"><h2>Staff access is not yet assigned</h2><p>Your Charis account is signed in, but has not been granted this workspace. Ask an administrator to invite you or update your role.</p></section></WorkspaceShell>;
 const [contacts,groups,campaigns,pending,approved,queued,recent]=await Promise.all([
  db.from('contacts').select('id',{head:true,count:'exact'}).eq('organization_id',org).is('archived_at',null),
  db.from('contact_lists').select('id',{head:true,count:'exact'}).eq('organization_id',org),
  db.from('campaign_drafts').select('id',{head:true,count:'exact'}).eq('organization_id',org),
  db.from('campaign_drafts').select('id',{head:true,count:'exact'}).eq('organization_id',org).eq('status','pending_approval'),
  db.from('campaign_drafts').select('id',{head:true,count:'exact'}).eq('organization_id',org).eq('status','approved'),
  db.from('campaign_runs').select('id',{head:true,count:'exact'}).eq('organization_id',org).in('status',['queued','running']),
  db.from('campaign_drafts').select('id,name,status,updated_at').eq('organization_id',org).order('updated_at',{ascending:false}).limit(5)
 ]);
 const stats=[
  {label:'Active customers',value:contacts.error?'—':contacts.count??0,icon:UsersRound},
  {label:'Saved groups',value:groups.error?'—':groups.count??0,icon:ListChecks},
  {label:'All campaigns',value:campaigns.error?'—':campaigns.count??0,icon:Mail},
  {label:'Pending approvals',value:pending.error?'—':pending.count??0,icon:ClipboardCheck},
 ];
 const links=[
  {icon:Mail,label:'Create campaign',description:'Write your message and choose one person, selected customers or a group.',path:`/dashboard/campaigns?org=${org}&create=1`},
  {icon:UploadCloud,label:'Import customers',description:'Upload CSV or Excel and organise contacts into a list.',path:`/dashboard/imports?org=${org}`},
  {icon:ClipboardCheck,label:'Review approvals',description:'Inspect pending messages and record approval decisions.',path:`/dashboard/approvals?org=${org}`},
  {icon:UsersRound,label:'Manage customers',description:'Find, edit and safely archive customer contact records.',path:`/dashboard/contacts?org=${org}`},
  {icon:Send,label:'Send & track',description:'Dispatch approved campaigns and review provider responses.',path:`/dashboard/delivery?org=${org}`},
  {icon:BarChart3,label:'View reports',description:'See campaign performance and delivery outcomes.',path:`/dashboard/reports?org=${org}`}
 ];
 return <WorkspaceShell title="Communication overview" org={org}>
  {company.status!=='active'&&<div role="alert" className="notice">The Charis workspace is {company.status}. Customer sending remains restricted until an administrator activates it.</div>}
  <section className="charis-dashboard-hero"><span className="charis-eyebrow">CHARIS CUSTOMER COMMUNICATIONS</span><h2>Confident customer communication, all in one place.</h2><p>Create, review and deliver consistent messages with clear ownership and visibility throughout every campaign.</p><div className="actions"><Link className="btn" href={`/dashboard/campaigns?org=${org}&create=1`}>Create a campaign <ArrowUpRight size={17}/></Link><Link className="btn secondary" href={`/dashboard/approvals?org=${org}`}>View approvals</Link></div></section>
  <section className="charis-metrics" aria-label="Workspace statistics">{stats.map(({label,value,icon:Icon})=><div key={label}><div className="charis-stat-name"><Icon size={16}/><small>{label}</small></div><strong>{typeof value==='number'?value.toLocaleString('en-NG'):value}</strong></div>)}</section>
  <div className="charis-dashboard-split"><section className="panel"><div className="workspace-heading"><h2>Campaign activity</h2><Link className="inline-link" href={`/dashboard/campaigns?org=${org}`}>View all <ArrowUpRight size={14}/></Link></div><div className="charis-secondary-metrics"><div><span>Approved, ready to send</span><strong>{approved.error?'—':approved.count??0}</strong></div><div><span>Queued or running</span><strong>{queued.error?'—':queued.count??0}</strong></div></div>{recent.error?<p role="alert" className="feedback-error">Recent campaign activity could not be loaded.</p>:!recent.data?.length?<p className="muted">No campaigns yet. Create your first message to get started.</p>:<div className="charis-recent-list">{recent.data.map(c=><Link key={c.id} href={`/dashboard/campaigns?org=${org}&id=${c.id}`}><span><Mail size={16}/><strong>{c.name}</strong><small>{new Date(c.updated_at).toLocaleDateString('en-NG')}</small></span><span className="status-chip">{c.status.replaceAll('_',' ')}</span></Link>)}</div>}</section>
  <section className="panel charis-next-steps"><h2>How a campaign moves</h2><p className="muted">A clear, accountable communication process for the bank.</p><ol><li><strong>Choose recipients</strong><small>Select a customer, group or eligible audience.</small></li><li><strong>Write and test</strong><small>Preview your message and email a test to yourself.</small></li><li><strong>Submit for approval</strong><small>An authorised reviewer approves or rejects the message.</small></li><li><strong>Send and monitor</strong><small>Dispatch approved messages and review outcomes.</small></li></ol><div className="charis-guide-card"><ShieldCheck size={17}/> Customer marketing messages respect consent and unsubscribe records.</div></section></div>
  <div className="workspace-heading" style={{marginTop:32}}><h2>Quick access</h2><span className="muted">Frequently used tools</span></div><section className="charis-shortcuts" aria-label="Quick actions">{links.map(({icon:Icon,label,description,path})=><Link key={label} href={path}><span><Icon size={21}/></span><strong>{label}</strong><small>{description}</small><span className="charis-quick-arrow">Open <ArrowUpRight size={14}/></span></Link>)}</section>
 </WorkspaceShell>;
}
