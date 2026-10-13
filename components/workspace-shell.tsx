import Link from 'next/link';
import Image from 'next/image';
import type {ReactNode} from 'react';
import {BarChart3, ClipboardCheck, FileText, FolderKanban, LayoutDashboard, LayoutTemplate, Mail, Menu, Palette, PenSquare, ScrollText, Send, Settings2, UserCog, Users, Upload, Filter} from 'lucide-react';
import {currentAccount} from '@/lib/auth/account';
import {brand} from '@/lib/brand';
import {charisBrandAssets} from '@/lib/charis-brand-assets';
import {SignOutForm} from '@/components/signout-form';
import {NavLink} from '@/components/nav-link';

/**
 * Charis Campaign Centre application shell.
 * Single-company product: SINGLE_COMPANY_MODE is the only supported mode, so the
 * navigation stays focused on day-to-day campaign work for Charis staff.
 */
export async function WorkspaceShell({title, subtitle, actions, org, children}: {
  title: string; subtitle?: string; actions?: ReactNode; org?: string; admin?: boolean; children: ReactNode;
}) {
  const [account, assets] = await Promise.all([currentAccount(), charisBrandAssets()]);
  const admin = account?.admin === true;
  org = org || account?.workspace?.id;
  const scoped = (path: string, extra = '') => (org ? `${path}?org=${encodeURIComponent(org)}${extra}` : path);
  const liveSending = process.env.EMAIL_DELIVERY_ENABLED === 'true';
  const email = account?.email || '';
  const initials = (email.split('@')[0] || 'C').replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || 'C';
  const logo = assets.logo || brand.logo;
  const ic = 18;
  return (
    <div className="app">
      <input id="nav-toggle" type="checkbox" className="nav-toggle" aria-label="Toggle navigation"/>
      <label htmlFor="nav-toggle" className="nav-scrim" aria-hidden="true"/>
      <aside className="sidebar">
        <Link href="/dashboard" className="brand-lockup" aria-label="Charis Campaign Centre home">
          <Image unoptimized src={logo} width={150} height={34} alt="Charis Microfinance Bank" priority/>
          <span className="brand-product">Campaign Centre</span>
        </Link>
        <nav aria-label="Charis navigation">
          <NavLink href="/dashboard"><LayoutDashboard size={ic}/> Overview</NavLink>

          <div className="sidebar-label">Campaigns</div>
          <NavLink href={scoped('/dashboard/campaigns', '&create=1')} match="/dashboard/campaigns/new"><PenSquare size={ic}/> New campaign</NavLink>
          <NavLink href={scoped('/dashboard/campaigns')}><Mail size={ic}/> All campaigns</NavLink>
          <NavLink href={scoped('/dashboard/approvals')}><ClipboardCheck size={ic}/> Approvals</NavLink>
          <NavLink href={scoped('/dashboard/delivery')}><Send size={ic}/> Send &amp; delivery</NavLink>
          <NavLink href={scoped('/dashboard/reports')}><BarChart3 size={ic}/> Reports</NavLink>

          <div className="sidebar-label">Audience</div>
          <NavLink href={scoped('/dashboard/contacts')}><Users size={ic}/> Customers</NavLink>
          <NavLink href={scoped('/dashboard/imports')}><Upload size={ic}/> Import contacts</NavLink>
          <NavLink href={scoped('/dashboard/lists')}><FolderKanban size={ic}/> Saved groups</NavLink>
          <NavLink href={scoped('/dashboard/segments')}><Filter size={ic}/> Smart segments</NavLink>

          <div className="sidebar-label">Settings</div>
          <NavLink href={scoped('/dashboard/templates')}><LayoutTemplate size={ic}/> Email templates</NavLink>
          <NavLink href={scoped('/dashboard/branding')}><Palette size={ic}/> Brand &amp; footer</NavLink>
          <NavLink href={scoped('/dashboard/senders')}><FileText size={ic}/> Sender settings</NavLink>
          <NavLink href={scoped('/dashboard/team')}><UserCog size={ic}/> Team access</NavLink>

          {admin && <>
            <div className="sidebar-label">Administration</div>
            <NavLink href="/admin/providers"><Settings2 size={ic}/> Email providers</NavLink>
            <NavLink href="/admin/audit"><ScrollText size={ic}/> Audit log</NavLink>
          </>}
        </nav>
        <div className="sidebar-foot">
          <div className="user-card">
            <span className="avatar" aria-hidden="true">{initials}</span>
            <div style={{minWidth: 0}}>
              <strong style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{email || 'Staff member'}</strong>
              <small>{admin ? 'Administrator' : 'Authorised staff'}</small>
            </div>
          </div>
          <SignOutForm/>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <label htmlFor="nav-toggle" className="menu-btn" aria-label="Open navigation"><Menu size={20}/></label>
          <div className="crumbs"><Link href="/dashboard">Charis</Link><span aria-hidden="true">/</span><span className="topbar-title">{title}</span></div>
          <div className="topbar-spacer"/>
          <span className="topbar-env" title={liveSending ? 'Approved campaigns can be sent to customers.' : 'Customer sending is turned off. Test emails only.'}>
            <span className={liveSending ? 'dot' : 'dot off'}/>{liveSending ? 'Live sending on' : 'Test mode'}
          </span>
        </header>
        <main className="page" id="main">
          <div className="page-head">
            <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
            {actions && <div className="actions" style={{marginTop: 0}}>{actions}</div>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
