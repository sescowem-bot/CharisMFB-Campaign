import Link from 'next/link';
import Image from 'next/image';
import type {ReactNode} from 'react';
import {BarChart3,ClipboardCheck,FileText,FolderKanban,LayoutDashboard,Mail,Menu,Palette,PenSquare,ScrollText,Send,Settings2,UserCog,Users,Upload,Filter,ArrowRight} from 'lucide-react';
import {currentAccount} from '@/lib/auth/account';
import {currentVerifiedUser} from '@/lib/auth/current-user';
import {charisBrandAssets} from '@/lib/charis-brand-assets';
import {SignOutForm} from '@/components/signout-form';
import {NavLink} from '@/components/nav-link';

/** Claude-reference Charis shell. Functional modules and access checks remain unchanged. */
export async function WorkspaceShell({title,subtitle,actions,org,admin:adminRequested=false,children}:{
  title:string;subtitle?:string;actions?:ReactNode;org?:string;admin?:boolean;children:ReactNode;
}) {
  const [account,assets,verifiedUser]=await Promise.all([currentAccount(),charisBrandAssets(),currentVerifiedUser()]);
  const admin=account?.admin===true;
  const workspace=org||account?.workspace?.id;
  const scoped=(path:string,extra='')=>workspace?`${path}?org=${encodeURIComponent(workspace)}${extra}`:path;
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
        <div className="sidebar-label">Campaigns</div>
        <NavLink href={scoped('/dashboard/campaigns','&create=1')} match="/dashboard/campaigns/new"><PenSquare size={18}/> Create campaign</NavLink>
        <NavLink href={scoped('/dashboard/campaigns')}><Mail size={18}/> All campaigns</NavLink>
        <NavLink href={scoped('/dashboard/approvals')}><ClipboardCheck size={18}/> Approvals</NavLink>
        <NavLink href={scoped('/dashboard/delivery')}><Send size={18}/> Send &amp; delivery</NavLink>
        <NavLink href={scoped('/dashboard/reports')}><BarChart3 size={18}/> Reports</NavLink>
        <div className="sidebar-label">Customers</div>
        <NavLink href={scoped('/dashboard/contacts')}><Users size={18}/> Manage customers</NavLink>
        <NavLink href={scoped('/dashboard/imports')}><Upload size={18}/> Import contacts</NavLink>
        <NavLink href={scoped('/dashboard/lists')}><FolderKanban size={18}/> Saved groups</NavLink>
        <NavLink href={scoped('/dashboard/segments')}><Filter size={18}/> Audience filters</NavLink>
        <div className="sidebar-label">Settings</div>
        <NavLink href={scoped('/dashboard/templates')}><FileText size={18}/> Email templates</NavLink>
        <NavLink href={scoped('/dashboard/senders')}><Mail size={18}/> Sender settings</NavLink>
        <NavLink href={scoped('/dashboard/branding')}><Palette size={18}/> Brand &amp; media</NavLink>
        <NavLink href={scoped('/dashboard/footers')}><FileText size={18}/> Email footers</NavLink>
        <NavLink href={scoped('/dashboard/team')}><UserCog size={18}/> Team access</NavLink>
        {(admin||account?.providerAdmin===true)&&<><div className="sidebar-label">Administration</div><NavLink href="/admin/providers"><Settings2 size={18}/> Email providers</NavLink>{admin&&<NavLink href="/admin/audit"><ScrollText size={18}/> Audit log</NavLink>}</>}
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
        <div className="topbar-spacer"/>
        <span className="topbar-env" title={liveSending?'Approved customer campaigns may be sent.':'You can send staff test emails now. Customer campaigns stay off until the delivery worker and approval checks are enabled.'}><span className={liveSending?'dot':'dot off'}/>{liveSending?'Customer sending on':'Customer sending off'}</span>
      </header>
      <main className="page" id="main">
        <div className="page-head"><div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{actions&&<div className="actions" style={{marginTop:0}}>{actions}</div>}</div>
        {adminRequested&&!admin&&<div className="notice">Some administrator functions require additional access.</div>}
        {children}
      </main>
    </div>
  </div>;
}
