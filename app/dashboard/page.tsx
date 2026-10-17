import Link from 'next/link';
import {redirect} from 'next/navigation';
import {supabaseServer} from '@/lib/supabase/server';
import {canSendDirect} from '@/lib/auth/direct-send-access';
import {currentAccount} from '@/lib/auth/account';
import {WorkspaceShell} from '@/components/workspace-shell';
import {StaffGettingStarted} from '@/components/staff-getting-started';
import {UsersRound,ListChecks,Mail,ClipboardCheck,Send,ArrowUpRight,Bell} from 'lucide-react';

export const dynamic='force-dynamic';
export default async function Dashboard(){
 const account=await currentAccount();
 if(!account)redirect('/login');
 const org=process.env.SINGLE_COMPANY_ORG_ID;
 if(!org)redirect('/setup-required');
 // One authorised database request provides all dashboard counts and recent activity.
 const db=await supabaseServer();
 const [{data:overview,error:dashboardError},canSend]=await Promise.all([db.rpc('charis_dashboard_overview',{p_org:org}),canSendDirect(org)]);
 if(dashboardError)return <WorkspaceShell org={org} title="Communication overview"><section className="panel"><h2>Dashboard metrics unavailable</h2><p role="alert">Charis cannot load dashboard metrics yet. Please contact the system administrator. Other modules remain available from the menu.</p></section></WorkspaceShell>;
 if(!overview)return <WorkspaceShell org={org} title="Access pending"><section className="panel"><h2>Staff access is not yet assigned</h2><p>Your Charis account is signed in, but has not been granted this workspace. Ask an administrator to invite you or update your role.</p></section></WorkspaceShell>;
 type RecentCampaign={id:string;name:string;status:string;updated_at:string};
 type DashboardOverview={name:string;status:string;contacts:number;groups:number;campaigns:number;pending:number;approved:number;queued:number;recent:RecentCampaign[]};
 const data=overview as DashboardOverview;
 const canViewCampaigns=account.permissions.includes('campaigns.view');
 const canCreate=canSend;
 const canApprove=account.permissions.includes('campaigns.approve')&&account.admin===true;
 const canManageCustomers=account.permissions.includes('customers.manage');
 const canReadCustomers=canManageCustomers||account.permissions.includes('customers.view');
 const canReadReminders=account.permissions.includes('reminders.view');
 const recentCampaigns=canViewCampaigns&&Array.isArray(data.recent)?data.recent:[];
 const scoped=(path:string,extra='')=>extra?`${path}?${extra.replace(/^&/,'')}`:path; // Avoid redirecting through ?org on every navigation.
 const number=(value:number)=>Number(value||0).toLocaleString('en-NG');
 const metrics=[
  {name:'Authorised customers',value:data.contacts,detail:'Customers you can access',icon:UsersRound,show:canReadCustomers},
  {name:'Saved groups',value:data.groups,detail:'Reusable customer audiences',icon:ListChecks,show:canManageCustomers},
  {name:'Previous campaigns',value:data.campaigns,detail:'Earlier campaign records',icon:Mail,show:canViewCampaigns&&account.admin===true},
  {name:'Awaiting review',value:data.pending,detail:'Previous approval requests',icon:ClipboardCheck,show:canViewCampaigns&&canApprove}
 ].filter(item=>item.show);
 const shortcuts=[
  {title:'Create Campaign',description:'Compose, select recipients and send.',path:'/dashboard/communications/new',icon:Mail,show:canCreate},
  {title:'Import Contacts',description:'Upload an Excel or CSV customer list.',path:scoped('/dashboard/imports'),icon:UsersRound,show:canManageCustomers},
  {title:'Contacts',description:'Find customers and manage groups.',path:canManageCustomers?scoped('/dashboard/contacts'):scoped('/dashboard/customers'),icon:UsersRound,show:canReadCustomers},
  {title:'All Campaigns',description:'View messages and their delivery status.',path:'/dashboard/communications',icon:Send,show:canCreate},
  {title:'My tasks',description:'Manage internal assignments, deadlines and department tasks.',path:scoped('/dashboard/tasks'),icon:Bell,show:canReadReminders}
 ].filter(item=>item.show);
 return <WorkspaceShell org={org} title="Communication overview" subtitle="Charis Microfinance Bank · Customer communications">
  <section className="hero-card">
   <span className="eyebrow">CHARIS COMMUNICATION CENTRE</span>
   <h2>Customer communications, made simple.</h2>
   <p>Create a campaign, choose contacts and send. Track every message in one place.</p>
   <div className="actions">{canCreate&&<Link className="btn accent" href="/dashboard/communications/new"><Mail size={16}/> Create Campaign</Link>}{canManageCustomers&&<Link className="btn secondary" href={scoped('/dashboard/imports')}><UsersRound size={16}/> Import Contacts</Link>}{!canCreate&&!canApprove&&canReadCustomers&&<Link className="btn secondary" href="/dashboard/customers"><UsersRound size={16}/> Contacts</Link>}</div>
  </section>
  <StaffGettingStarted userId={account.id} contactsPath={canManageCustomers?scoped('/dashboard/contacts'):'/dashboard/customers'}/>
  {data.status!=='active'&&<div className="notice" role="alert">Charis is currently {data.status}. Live sending remains disabled until the workspace is active.</div>}
  {canApprove&&data.pending>0&&<div className="notice" role="status"><strong>{number(data.pending)} campaign{data.pending===1?'':'s'} awaiting approval.</strong> <Link className="inline-link" href={scoped('/dashboard/approvals')}>Review requests</Link></div>}
  <section className="stat-grid" aria-label="Campaign summary">
   {metrics.map(({name,value,detail,icon:Icon})=><div className="stat" key={name}><div className="stat-label"><Icon size={17}/>{name}</div><strong className="stat-value">{number(value)}</strong><span className="stat-note">{detail}</span></div>)}
  </section>
  {canViewCampaigns&&account.admin===true&&<><div className="page-head" style={{marginTop:32,marginBottom:8}}><div><h2>Previous campaign records</h2><p>Older campaign history</p></div><Link className="btn ghost sm" href={scoped('/dashboard/campaigns')}>View all <ArrowUpRight size={15}/></Link></div>
  {recentCampaigns.length ? <div className="table-scroll"><table className="admin-table"><thead><tr><th>Campaign</th><th>Status</th><th>Updated</th></tr></thead><tbody>{recentCampaigns.map(c=><tr key={c.id}><td><Link className="inline-link" href={scoped('/dashboard/campaigns',`&id=${encodeURIComponent(c.id)}`)}>{c.name}</Link></td><td><span className="status-chip">{c.status.replaceAll('_',' ')}</span></td><td>{new Date(c.updated_at).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})}</td></tr>)}</tbody></table></div>:
   <section className="empty"><Mail size={28}/><h3>No campaigns yet</h3><p>Create your first customer communication to get started.</p><Link className="btn" href="/dashboard/communications/new">Create Campaign</Link></section>}
  </>}
  <div className="page-head" style={{marginTop:32,marginBottom:8}}><div><h2>Quick actions</h2></div></div>
  <div className="tile-grid">{shortcuts.map(({title,description,path,icon:Icon})=><Link className="tile" key={title} href={path}><span className="tile-icon"><Icon size={21}/></span><strong>{title}</strong><small>{description}</small><span className="tile-arrow">Open <ArrowUpRight size={14}/></span></Link>)}</div>
 </WorkspaceShell>;
}
