import Link from 'next/link';
import Image from 'next/image';
import type {ReactNode} from 'react';
import {Activity,ArrowRight,Bell,CalendarClock,ClipboardCheck,FileText,Landmark,LayoutDashboard,Mail,Menu,Settings2,ShieldCheck,Users,UserPlus,Upload,Layers,Send,BookOpen} from 'lucide-react';
import {currentAccount} from '@/lib/auth/account';
import {currentVerifiedUser} from '@/lib/auth/current-user';
import {canSendDirect} from '@/lib/auth/direct-send-access';
import {charisBrandAssets} from '@/lib/charis-brand-assets';
import {SignOutForm} from '@/components/signout-form';
import {NavLink} from '@/components/nav-link';
import {SidebarSection} from '@/components/sidebar-section';

/** Permission-aware staff shell. Keep administrative tools outside ordinary staff menus. */
export async function WorkspaceShell({title,subtitle,actions,children}:{
  title:string;subtitle?:string;actions?:ReactNode;org?:string;admin?:boolean;children:ReactNode;
}) {
  const [account,assets,verifiedUser]=await Promise.all([currentAccount(),charisBrandAssets(),currentVerifiedUser()]);
  const admin=account?.admin===true;
  const permitted=(key:string)=>account?.permissions?.includes(key)===true;
  const canAny=(...keys:string[])=>keys.some(permitted);
  const canAdmin=Boolean(account?.owner||canAny('staff.manage','access.manage','departments.manage','branches.manage','providers.manage','settings.manage','audit.view'));
  const forBank=(path:string)=>path; // Middleware injects the verified Charis organisation internally.
  const directAllowed=account?await canSendDirect(account.workspace.id):false;
  const canCommunicate=directAllowed||canAny('templates.manage','campaigns.view','campaigns.create','service_notices.view','service_notices.create','service_notices.approve','credit_reminders.view','credit_reminders.create');
  const canCredit=canAny('loans.view','loans.manage','loans.repayments','credit_reminders.view','credit_reminders.create','credit_reminders.approve','credit_reminders.queue','credit_reminders.dispatch','credit_followups.view','credit_followups.create','credit_followups.manage');
  const liveSending=process.env.EMAIL_DELIVERY_ENABLED==='true';
  const email=verifiedUser?.email||'';
  const initials=(email.split('@')[0]||'C').replace(/[^a-z0-9]/gi,'').slice(0,2).toUpperCase()||'C';
  return <div className="app">
    <input id="nav-toggle" type="checkbox" className="nav-toggle" aria-label="Toggle navigation"/>
    <label htmlFor="nav-toggle" className="nav-scrim" aria-hidden="true"/>
    <aside className="sidebar">
      <Link href="/dashboard" className="brand-lockup" aria-label="Charis Campaign Centre dashboard">
        <Image unoptimized src={assets.logo||'/charis-official-logo.png'} width={165} height={40} alt="Charis Microfinance Bank Ltd" priority/>
        <span className="brand-product">Campaign Centre</span>
      </Link>
      <nav aria-label="Charis workspace navigation">
        <NavLink href="/dashboard"><LayoutDashboard size={18}/> Dashboard</NavLink>
        {directAllowed&&<NavLink href="/dashboard/communications/new"><Send size={18}/> Create Campaign</NavLink>}
        {canCommunicate&&<NavLink href="/dashboard/zoho-smtp"><Mail size={18}/> Zoho Mail &amp; Test</NavLink>}
        {canCommunicate&&<NavLink href="/dashboard/zeptomail"><Mail size={18}/> ZeptoMail Notices</NavLink>}
        {canCommunicate&&<SidebarSection title="Campaigns" routes={['/dashboard/communications','/dashboard/templates','/dashboard/campaigns']}>
          <NavLink href="/dashboard/communications" exact><Mail size={18}/> All Campaigns</NavLink>
          {permitted('templates.manage')&&<NavLink href={forBank('/dashboard/templates')}><FileText size={18}/> Design Templates</NavLink>}
          {canAdmin&&permitted('campaigns.view')&&<NavLink href={forBank('/dashboard/campaigns')}><Layers size={18}/> Previous Campaigns</NavLink>}
        </SidebarSection>}
        {canAny('customers.view','customers.manage')&&<SidebarSection title="Contacts" routes={['/dashboard/contacts','/dashboard/customers','/dashboard/imports','/dashboard/lists','/dashboard/segments','/dashboard/preferences']}>
          <NavLink href={permitted('customers.manage')?forBank('/dashboard/contacts'):'/dashboard/customers'}><Users size={18}/> All Contacts</NavLink>
          {permitted('customers.manage')&&<>
            <NavLink href={`${forBank('/dashboard/contacts')}#new-contact`} match="/dashboard/contacts/new"><UserPlus size={18}/> Add Contact</NavLink>
            <NavLink href={forBank('/dashboard/imports')}><Upload size={18}/> Import Contacts</NavLink>
            <NavLink href={forBank('/dashboard/lists')}><Layers size={18}/> Contact Groups</NavLink>
          </>}
        </SidebarSection>}
        {canCredit&&<SidebarSection title="Credit Operations" routes={['/dashboard/loans','/dashboard/credit-reminders','/dashboard/credit-followups']}>
          {canAny('loans.view','loans.manage','loans.repayments')&&<NavLink href="/dashboard/loans"><Landmark size={18}/> Loan Portfolio</NavLink>}
          {canAny('credit_reminders.view','credit_reminders.create','credit_reminders.approve','credit_reminders.queue','credit_reminders.dispatch')&&<NavLink href="/dashboard/credit-reminders"><CalendarClock size={18}/> Loan Reminders</NavLink>}
          {canAny('credit_followups.view','credit_followups.create','credit_followups.manage')&&<NavLink href="/dashboard/credit-followups"><ClipboardCheck size={18}/> Credit Follow-ups</NavLink>}
        </SidebarSection>}
        <SidebarSection title="Workspace" routes={['/dashboard/tasks','/dashboard/reports','/dashboard/insights','/dashboard/notifications','/dashboard/help']}>
          {canAny('reminders.view','reminders.create')&&<NavLink href={forBank('/dashboard/tasks')}><ClipboardCheck size={18}/> My Tasks</NavLink>}
          {canAny('reports.view','operations.view')&&<NavLink href={permitted('operations.view')?'/dashboard/insights':forBank('/dashboard/reports')}><Activity size={18}/> Reports</NavLink>}
          <NavLink href="/dashboard/notifications"><Bell size={18}/> Notifications</NavLink>
          <NavLink href="/dashboard/help"><BookOpen size={18}/> Help & Guides</NavLink>
        </SidebarSection>
        {canAdmin&&<><div className="sidebar-label">Administration</div><NavLink href="/admin"><Settings2 size={18}/> Administration</NavLink></>}
      </nav>
      <div className="sidebar-foot">
        <div className="user-card"><span className="avatar" aria-hidden="true">{initials}</span><div style={{minWidth:0}}><strong style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{email||'Charis staff'}</strong><small>{admin?'Administrator':'Authorised staff'}</small></div></div>
        <SignOutForm/>
      </div>
    </aside>
    <div className="main">
      <header className="topbar">
        <label htmlFor="nav-toggle" className="menu-btn" aria-label="Open navigation"><Menu size={20}/></label>
        <div className="crumbs"><Link href="/dashboard">Charis</Link><ArrowRight size={13} aria-hidden="true"/><span className="topbar-title">{title}</span></div>
        <div className="topbar-spacer"/><Link className="charis-top-help" href="/dashboard/help"><ShieldCheck size={15}/> Help</Link>
        {canAdmin&&<span className="topbar-env" title={liveSending?'Email delivery switch enabled; individual channels and workers may still be unavailable.':'Email delivery switch disabled.'}><span className={liveSending?'dot':'dot off'}/>{liveSending?'Email enabled':'Email disabled'}</span>}
      </header>
      <main className="page" id="main">
        <div className="page-head"><div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{actions&&<div className="actions" style={{marginTop:0}}>{actions}</div>}</div>

        {children}
      </main>
    </div>
  </div>;
}
