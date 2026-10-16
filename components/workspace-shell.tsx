import Link from 'next/link';
import Image from 'next/image';
import type {ReactNode} from 'react';
import {Activity,ArrowRight,Bell,CalendarClock,ClipboardCheck,FileText,Landmark,LayoutDashboard,Mail,Menu,Settings2,ShieldCheck,Users} from 'lucide-react';
import {currentAccount} from '@/lib/auth/account';
import {currentVerifiedUser} from '@/lib/auth/current-user';
import {supabaseServer} from '@/lib/supabase/server';
import {charisBrandAssets} from '@/lib/charis-brand-assets';
import {SignOutForm} from '@/components/signout-form';
import {NavLink} from '@/components/nav-link';

/** Claude-reference Charis shell. Functional modules and access checks remain unchanged. */
export async function WorkspaceShell({title,subtitle,actions,children}:{
  title:string;subtitle?:string;actions?:ReactNode;org?:string;admin?:boolean;children:ReactNode;
}) {
  const [account,assets,verifiedUser]=await Promise.all([currentAccount(),charisBrandAssets(),currentVerifiedUser()]);
  const admin=account?.admin===true;
  const permitted=(key:string)=>account?.permissions?.includes(key)===true;
  const canAny=(...keys:string[])=>keys.some(permitted);
  const canAdmin=Boolean(account?.owner||canAny('staff.manage','access.manage','departments.manage','branches.manage','providers.manage','settings.manage','audit.view'));
  const org=account?.workspace?.id||'';
  const forBank=(path:string)=>`${path}?org=${encodeURIComponent(org)}`;
  const directAllowed=account?await (async()=>{try{const db=await supabaseServer();const {data}=await db.rpc('charis_direct_can_send',{p_org:account.workspace.id});return data===true;}catch{return false;}})():false;
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
        <NavLink href="/dashboard"><LayoutDashboard size={18}/> Overview</NavLink>
        {canCommunicate&&<>
          <div className="sidebar-label">Communications</div>
          <NavLink href="/dashboard/communications"><Mail size={18}/> Communications</NavLink>
          {permitted('templates.manage')&&<NavLink href={forBank('/dashboard/templates')}><FileText size={18}/> Design studio</NavLink>}
          {(permitted('campaigns.approve')||permitted('campaigns.send'))&&<details className="charis-advanced-nav"><summary>Legacy campaign tools</summary>
            {permitted('campaigns.approve')&&<NavLink href={forBank('/dashboard/approvals')}><ClipboardCheck size={18}/> Approvals</NavLink>}
            {permitted('campaigns.send')&&<NavLink href={forBank('/dashboard/delivery')}><Activity size={18}/> Delivery status</NavLink>}
          </details>}
        </>}
        {canAny('customers.view','customers.manage')&&<>
          <div className="sidebar-label">Customers</div>
          <NavLink href={permitted('customers.manage')?forBank('/dashboard/contacts'):'/dashboard/customers'}><Users size={18}/> Customers</NavLink>
        </>}
        {canCredit&&<>
          <div className="sidebar-label">Credit operations</div>
          {canAny('loans.view','loans.manage','loans.repayments')&&<NavLink href="/dashboard/loans"><Landmark size={18}/> Loan register</NavLink>}
          {canAny('credit_reminders.view','credit_reminders.create','credit_reminders.approve','credit_reminders.queue','credit_reminders.dispatch')&&<NavLink href="/dashboard/credit-reminders"><CalendarClock size={18}/> Loan reminders</NavLink>}
          {canAny('credit_followups.view','credit_followups.create','credit_followups.manage')&&<NavLink href="/dashboard/credit-followups"><ClipboardCheck size={18}/> Credit follow-ups</NavLink>}
        </>}
        {canAny('reports.view','operations.view')&&<NavLink href={permitted('operations.view')?'/dashboard/insights':forBank('/dashboard/reports')}><Activity size={18}/> Reports</NavLink>}
        {canAny('reminders.view','reminders.create')&&<NavLink href={forBank('/dashboard/tasks')}><ClipboardCheck size={18}/> My tasks</NavLink>}
        <NavLink href="/dashboard/notifications"><Bell size={18}/> Staff alerts</NavLink>
        {canAdmin&&<>
          <div className="sidebar-label">Management</div>
          <NavLink href="/admin"><Settings2 size={18}/> Administration</NavLink>
        </>}
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
        <div className="topbar-spacer"/><Link className="charis-top-help" href="/dashboard/help"><ShieldCheck size={15}/> Help &amp; workflows</Link>
        <span className="topbar-env" title={liveSending?'The application delivery flag is enabled. Sender eligibility, approvals, provider configuration and worker status must still be verified.':'Customer campaign dispatch is disabled; permitted staff tests can be run separately.'}><span className={liveSending?'dot':'dot off'}/>{liveSending?'Delivery gate enabled':'Customer sending off'}</span>
      </header>
      <main className="page" id="main">
        <div className="page-head"><div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{actions&&<div className="actions" style={{marginTop:0}}>{actions}</div>}</div>

        {children}
      </main>
    </div>
  </div>;
}
