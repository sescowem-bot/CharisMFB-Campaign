import Link from 'next/link';
import {redirect} from 'next/navigation';
import {supabaseServer} from '@/lib/supabase/server';
import {currentAccount} from '@/lib/auth/account';
import {WorkspaceShell} from '@/components/workspace-shell';
import {UsersRound,ListChecks,Mail,ClipboardCheck,Send,ShieldCheck,ArrowUpRight,Bell} from 'lucide-react';

export const dynamic='force-dynamic';
export default async function Dashboard(){
 const account=await currentAccount();
 if(!account)redirect('/login');
 const org=process.env.SINGLE_COMPANY_ORG_ID;
 if(!org)redirect('/setup-required');
 // One authorised database request provides all dashboard counts and recent activity.
 const db=await supabaseServer();
 const {data:overview,error:dashboardError}=await db.rpc('charis_dashboard_overview',{p_org:org});
 if(dashboardError)return <WorkspaceShell org={org} title="Communication overview"><section className="panel"><h2>Dashboard metrics unavailable</h2><p role="alert">Charis cannot load dashboard metrics yet. Please contact the system administrator. Other modules remain available from the menu.</p></section></WorkspaceShell>;
 if(!overview)return <WorkspaceShell org={org} title="Access pending"><section className="panel"><h2>Staff access is not yet assigned</h2><p>Your Charis account is signed in, but has not been granted this workspace. Ask an administrator to invite you or update your role.</p></section></WorkspaceShell>;
 type RecentCampaign={id:string;name:string;status:string;updated_at:string};
 type DashboardOverview={name:string;status:string;contacts:number;groups:number;campaigns:number;pending:number;approved:number;queued:number;recent:RecentCampaign[]};
 const data=overview as DashboardOverview;
 const recentCampaigns=Array.isArray(data.recent)?data.recent:[];
 const scoped=(path:string,extra='')=>extra?`${path}?${extra.replace(/^&/,'')}`:path;
 const number=(value:number)=>Number(value||0).toLocaleString('en-NG');
 const metrics=[
  {name:'Active customers',value:data.contacts,detail:'Customers in the address book',icon:UsersRound},
  {name:'Saved groups',value:data.groups,detail:'Reusable customer audiences',icon:ListChecks},
  {name:'Campaigns',value:data.campaigns,detail:'Drafts and previous sends',icon:Mail},
  {name:'Awaiting review',value:data.pending,detail:'Campaigns pending approval',icon:ClipboardCheck}
 ];
 const shortcuts=[
  {title:'Create a campaign',description:'Write a message for one person, a group or an eligible audience.',path:scoped('/dashboard/campaigns','&create=1'),icon:Mail},
  {title:'Review approvals',description:'Review submitted messages and record a decision.',path:scoped('/dashboard/approvals'),icon:ShieldCheck},
  {title:'Manage customers',description:'Search customers, organise groups and update contact records.',path:scoped('/dashboard/contacts'),icon:UsersRound},
  {title:'Send and track',description:'Queue approved messages and see delivery outcomes.',path:scoped('/dashboard/delivery'),icon:Send},
  {title:'My reminders',description:'See follow-ups, upcoming tasks and department responsibilities.',path:scoped('/dashboard/reminders'),icon:Bell}
 ];
 return <WorkspaceShell org={org} title="Communication overview" subtitle="Charis Microfinance Bank · Customer communications">
  <section className="hero-card">
   <span className="eyebrow">CHARIS COMMUNICATION CENTRE</span>
   <h2>Reach the right customers, with confidence.</h2>
   <p>Create your message, select recipients, request approval and track delivery in one simple workspace.</p>
   <div className="actions"><Link className="btn accent" href={scoped('/dashboard/campaigns','&create=1')}><Mail size={16}/> Create a campaign</Link><Link className="btn secondary" href={scoped('/dashboard/approvals')}><ClipboardCheck size={16}/> View approvals</Link></div>
  </section>
  {data.status!=='active'&&<div className="notice" role="alert">Charis is currently {data.status}. Live sending remains disabled until the workspace is active.</div>}
  {data.pending>0&&<div className="notice" role="status"><strong>{number(data.pending)} campaign{data.pending===1?'':'s'} awaiting approval.</strong> <Link className="inline-link" href={scoped('/dashboard/approvals')}>Review requests</Link></div>}
  <section className="stat-grid" aria-label="Campaign summary">
   {metrics.map(({name,value,detail,icon:Icon})=><div className="stat" key={name}><div className="stat-label"><Icon size={17}/>{name}</div><strong className="stat-value">{number(value)}</strong><span className="stat-note">{detail}</span></div>)}
  </section>
  <div className="page-head" style={{marginTop:32,marginBottom:8}}><div><h2>Recent campaigns</h2><p>Your latest saved and submitted messages</p></div><Link className="btn ghost sm" href={scoped('/dashboard/campaigns')}>View all <ArrowUpRight size={15}/></Link></div>
  {recentCampaigns.length ? <div className="table-scroll"><table className="admin-table"><thead><tr><th>Campaign</th><th>Status</th><th>Updated</th></tr></thead><tbody>{recentCampaigns.map(c=><tr key={c.id}><td><Link className="inline-link" href={scoped('/dashboard/campaigns',`&id=${encodeURIComponent(c.id)}`)}>{c.name}</Link></td><td><span className="status-chip">{c.status.replaceAll('_',' ')}</span></td><td>{new Date(c.updated_at).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})}</td></tr>)}</tbody></table></div>:
   <section className="empty"><Mail size={28}/><h3>No campaigns yet</h3><p>Create your first customer communication to get started.</p><Link className="btn" href={scoped('/dashboard/campaigns','&create=1')}>Create campaign</Link></section>}
  <div className="page-head" style={{marginTop:32,marginBottom:8}}><div><h2>Quick actions</h2><p>Everything your team needs to get work done</p></div></div>
  <div className="tile-grid">{shortcuts.map(({title,description,path,icon:Icon})=><Link className="tile" key={title} href={path}><span className="tile-icon"><Icon size={21}/></span><strong>{title}</strong><small>{description}</small><span className="tile-arrow">Open <ArrowUpRight size={14}/></span></Link>)}</div>
 </WorkspaceShell>;
}
