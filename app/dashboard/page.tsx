import Link from 'next/link';
import {redirect} from 'next/navigation';
import {supabaseServer} from '@/lib/supabase/server';
import {canSendDirect} from '@/lib/auth/direct-send-access';
import {currentAccount} from '@/lib/auth/account';
import {WorkspaceShell} from '@/components/workspace-shell';
import {StaffGettingStarted} from '@/components/staff-getting-started';
import {UsersRound,ListChecks,Mail,Send,ArrowUpRight,Bell} from 'lucide-react';

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
 type DashboardOverview={name:string;status:string;contacts:number;groups:number};
 const data=overview as DashboardOverview;
 const canCreate=canSend;
 const canManageCustomers=account.permissions.includes('customers.manage');
 const canReadCustomers=canManageCustomers||account.permissions.includes('customers.view');
 const canReadReminders=account.permissions.includes('reminders.view');
 const scoped=(path:string,extra='')=>extra?`${path}?${extra.replace(/^&/,'')}`:path; // Avoid redirecting through ?org on every navigation.
 const number=(value:number)=>Number(value||0).toLocaleString('en-NG');
 const metrics=[
  {name:'Authorised customers',value:data.contacts,detail:'Customers you can access',icon:UsersRound,show:canReadCustomers},
  {name:'Saved groups',value:data.groups,detail:'Reusable customer audiences',icon:ListChecks,show:canManageCustomers}
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
   <h2>Your communication workspace.</h2>
   <p>Manage customer contacts, prepare campaigns and access the tools you use every day.</p>
   <div className="actions">{canCreate&&<Link className="btn accent" href="/dashboard/communications/new"><Mail size={16}/> Create Campaign</Link>}{canManageCustomers&&<Link className="btn secondary" href={scoped('/dashboard/imports')}><UsersRound size={16}/> Import Contacts</Link>}{!canCreate&&!canApprove&&canReadCustomers&&<Link className="btn secondary" href="/dashboard/customers"><UsersRound size={16}/> Contacts</Link>}</div>
  </section>
  <StaffGettingStarted userId={account.id} contactsPath={canManageCustomers?scoped('/dashboard/contacts'):'/dashboard/customers'}/>
  {data.status!=='active'&&<div className="notice" role="alert">Charis is currently {data.status}. Live sending remains disabled until the workspace is active.</div>}
  <section className="stat-grid" aria-label="Campaign summary">
   {metrics.map(({name,value,detail,icon:Icon})=><div className="stat" key={name}><div className="stat-label"><Icon size={17}/>{name}</div><strong className="stat-value">{number(value)}</strong><span className="stat-note">{detail}</span></div>)}
  </section>
  <div className="page-head" style={{marginTop:32,marginBottom:8}}><div><h2>Quick actions</h2></div></div>
  <div className="tile-grid">{shortcuts.map(({title,description,path,icon:Icon})=><Link className="tile" key={title} href={path}><span className="tile-icon"><Icon size={21}/></span><strong>{title}</strong><small>{description}</small><span className="tile-arrow">Open <ArrowUpRight size={14}/></span></Link>)}</div>
 </WorkspaceShell>;
}
