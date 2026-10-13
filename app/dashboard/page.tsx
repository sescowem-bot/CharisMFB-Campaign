import Link from 'next/link';
import {redirect} from 'next/navigation';
import {ClipboardCheck, FolderKanban, Mail, PenSquare, Send, Upload, Users, BarChart3, ArrowRight} from 'lucide-react';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
import {Callout, EmptyState, Stat, StatusBadge, Tile} from '@/components/ui';
import {brand} from '@/lib/brand';

export const dynamic = 'force-dynamic';

export const metadata = {title: 'Overview'};

export default async function Dashboard() {
  const db = await supabaseServer();
  const {data: {user}} = await db.auth.getUser();
  if (!user) redirect('/login');

  const {data: owner} = await db.rpc('is_platform_super_admin');
  const {data: memberships, error} = await db.from('organization_members').select('organization_id,role,organizations(name,status)').eq('user_id', user.id);
  if (error) return <WorkspaceShell title="Overview"><Callout tone="danger" alert>Your workspace could not be loaded. Please refresh, or contact your administrator if this continues.</Callout></WorkspaceShell>;

  let companies = (memberships || []).map(m => ({
    id: m.organization_id,
    name: (m.organizations as {name?: string} | null)?.name || brand.name,
    status: (m.organizations as {status?: string} | null)?.status || 'pending',
    role: m.role as string
  }));
  if (owner) {
    const {data, error: e} = await db.from('organizations').select('id,name,status').order('name');
    if (e) return <WorkspaceShell title="Overview"><Callout tone="danger" alert>The workspace could not be loaded. Please retry.</Callout></WorkspaceShell>;
    companies = (data || []).map(c => ({...c, role: 'super_admin'}));
  }
  const configured = process.env.SINGLE_COMPANY_ORG_ID;
  const company = configured ? companies.find(c => c.id === configured) : companies.find(c => c.status === 'active');
  if (!company) {
    return (
      <WorkspaceShell title="Overview">
        <Callout tone="warning" alert>An active Charis workspace is required. Ask the administrator to assign your account and to set <code>SINGLE_COMPANY_ORG_ID</code>.</Callout>
      </WorkspaceShell>
    );
  }
  const org = company.id;
  const [contacts, campaigns, lists, approved, pending, recent] = await Promise.all([
    db.from('contacts').select('id', {count: 'exact', head: true}).eq('organization_id', org).is('archived_at', null),
    db.from('campaign_drafts').select('id', {count: 'exact', head: true}).eq('organization_id', org),
    db.from('contact_lists').select('id', {count: 'exact', head: true}).eq('organization_id', org),
    db.from('campaign_drafts').select('id', {count: 'exact', head: true}).eq('organization_id', org).eq('status', 'approved'),
    db.from('campaign_drafts').select('id', {count: 'exact', head: true}).eq('organization_id', org).eq('status', 'pending_approval'),
    db.from('campaign_drafts').select('id,name,status,updated_at').eq('organization_id', org).order('updated_at', {ascending: false}).limit(6)
  ]);
  const n = (v: number | null) => (v ?? 0).toLocaleString('en-NG');
  const q = `?org=${org}`;

  return (
    <WorkspaceShell org={org} title="Overview" subtitle={`${company.name} · Customer communications`}>
      <section className="hero-card">
        <span className="eyebrow">Communication centre</span>
        <h2>Reach the right customers, with confidence.</h2>
        <p>Compose a message, choose exactly who receives it, get an independent approval and track delivery, all in one controlled workflow.</p>
        <div className="actions">
          <Link className="btn accent" href={`/dashboard/campaigns${q}&create=1`}><PenSquare size={16}/> New campaign</Link>
          <Link className="btn secondary" href={`/dashboard/imports${q}`}><Upload size={16}/> Import customers</Link>
        </div>
      </section>

      {company.status !== 'active' && <Callout tone="warning" alert>This workspace is currently <strong>{company.status}</strong>. Contact your administrator before sending.</Callout>}
      {(pending.count ?? 0) > 0 && (
        <Callout tone="info">
          <strong>{pending.count} campaign{pending.count === 1 ? '' : 's'} awaiting approval.</strong>{' '}
          <Link className="inline-link" href={`/dashboard/approvals${q}`}>Open the approval inbox</Link>
        </Callout>
      )}

      <div className="stat-grid">
        <Stat label="Customers" value={n(contacts.count)} icon={Users} note="Active contact records"/>
        <Stat label="Saved groups" value={n(lists.count)} icon={FolderKanban} note="Reusable audiences"/>
        <Stat label="Campaigns" value={n(campaigns.count)} icon={Mail} note="All drafts and sent"/>
        <Stat label="Ready to send" value={n(approved.count)} icon={ClipboardCheck} note="Approved campaigns"/>
      </div>

      <div className="page-head" style={{marginTop: 34, marginBottom: 6}}><div><h2>Recent campaigns</h2></div><Link className="btn ghost sm" href={`/dashboard/campaigns${q}`}>View all <ArrowRight size={14}/></Link></div>
      {recent.data?.length ? (
        <div className="table-scroll">
          <table className="admin-table">
            <thead><tr><th>Campaign</th><th>Status</th><th>Last updated</th></tr></thead>
            <tbody>
              {recent.data.map(c => (
                <tr key={c.id}>
                  <td><Link className="inline-link" href={`/dashboard/campaigns${q}&id=${c.id}`}>{c.name}</Link></td>
                  <td><StatusBadge status={c.status}/></td>
                  <td className="muted">{new Date(c.updated_at).toLocaleString('en-NG', {dateStyle: 'medium', timeStyle: 'short'})}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={Mail} title="No campaigns yet" text="Create your first campaign. It takes about two minutes.">
          <Link className="btn" href={`/dashboard/campaigns${q}&create=1`}>Create a campaign</Link>
        </EmptyState>
      )}

      <div className="page-head" style={{marginTop: 34, marginBottom: 6}}><div><h2>Quick actions</h2></div></div>
      <div className="tile-grid">
        <Tile href={`/dashboard/campaigns${q}&create=1`} icon={PenSquare} title="Create a campaign" text="One customer, selected people, a saved group or everyone eligible."/>
        <Tile href={`/dashboard/approvals${q}`} icon={ClipboardCheck} title="Review approvals" text="Approve or reject campaigns waiting for an independent reviewer."/>
        <Tile href={`/dashboard/delivery${q}`} icon={Send} title="Send & track" text="Queue approved campaigns and follow delivery outcomes."/>
        <Tile href={`/dashboard/reports${q}`} icon={BarChart3} title="View reports" text="Audience, delivery and engagement results by campaign."/>
      </div>
    </WorkspaceShell>
  );
}
