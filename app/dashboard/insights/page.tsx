import Link from 'next/link';
import {redirect} from 'next/navigation';
import {WorkspaceShell} from '@/components/workspace-shell';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
import {formatNaira,operationalInsightsSchema,parseOperationalDates} from '@/lib/charis-operational-insights';
export const dynamic='force-dynamic';

type Params={from?:string;to?:string};
export default async function OperationalInsightsPage({searchParams}:{searchParams:Promise<Params>}){
 const account=await currentAccount();if(!account)redirect('/login');
 if(!account.owner&&!account.permissions.includes('operations.view')&&!account.permissions.includes('reports.view'))redirect('/dashboard');
 const org=account.workspace.id;
 const params=await searchParams;
 const dates=parseOperationalDates(params.from,params.to);
 if(!dates)return <WorkspaceShell org={org} title="Operations insights" subtitle="Operational reporting for authorised Charis staff.">
  <section className="panel"><h2>Check the reporting dates</h2><p role="alert">Choose valid dates within a period of no more than 366 days.</p><Link className="btn secondary" href="/dashboard/insights">Reset date range</Link></section>
 </WorkspaceShell>;
 const db=await supabaseServer();
 const {data,error}=await db.rpc('charis_operational_insights',{p_org:org,p_from:dates.p_from,p_until:dates.p_until});
 const result=operationalInsightsSchema.safeParse(data);
 if(error||!result.success)return <WorkspaceShell org={org} title="Operations insights" subtitle="Bank reporting for authorised staff.">
  <section className="panel"><h2>Insights unavailable</h2><p role="alert">Confirm Migration 034 is installed and that you have operational reporting permission.</p><Link href="/dashboard" className="btn secondary">Back to dashboard</Link></section>
 </WorkspaceShell>;
 const report=result.data;
 const has=(key:string)=>account.permissions.includes(key);
 const credit=has('loans.view')||has('loans.manage')||has('loans.repayments');
 const followups=has('credit_followups.view')||has('credit_followups.manage');
 const reminders=has('credit_reminders.view');
 const notices=has('service_notices.view');
 const sections=[
  {title:'Loan accounts',visible:credit,href:'/dashboard/loans',subtitle:'Internal loan register, reconciled balances required',
   stats:[['Active balances',report.loans.active.toLocaleString('en-NG')],['Overdue accounts',report.loans.overdue.toLocaleString('en-NG')],['Due in the next 7 days',report.loans.due_soon.toLocaleString('en-NG')],['Outstanding recorded',formatNaira(report.loans.outstanding)]]},
  {title:'Credit follow-ups',visible:followups,href:'/dashboard/credit-followups',subtitle:'Visible assignments and tasks only',
   stats:[['Open tasks',report.followups.open.toLocaleString('en-NG')],['Past due tasks',report.followups.overdue.toLocaleString('en-NG')],['Completed in date range',report.followups.completed_in_period.toLocaleString('en-NG')]]},
  {title:'Repayment reminders',visible:reminders,href:'/dashboard/credit-reminders',subtitle:'Records held or awaiting review — not proof of sending',
   stats:[['Awaiting approval',report.reminders.submitted.toLocaleString('en-NG')],['Approved',report.reminders.approved.toLocaleString('en-NG')],['Held, not sent',report.reminders.held.toLocaleString('en-NG')],['Created in date range',report.reminders.created_in_period.toLocaleString('en-NG')]]},
  {title:'Account-service notices',visible:notices,href:'/dashboard/communications/service',subtitle:'Prepared notices are never treated as promotional campaigns',
   stats:[['Awaiting review',report.notices.submitted.toLocaleString('en-NG')],['Approved drafts',report.notices.approved.toLocaleString('en-NG')],['Created in date range',report.notices.created_in_period.toLocaleString('en-NG')]]}
 ].filter(section=>section.visible);
 return <WorkspaceShell org={org} title="Operations insights" subtitle="A permission-scoped overview of credit and account-service work."
  actions={has('reports.view')?<Link className="btn secondary" href={`/dashboard/reports?org=${org}`}>Campaign delivery reports</Link>:undefined}>
  <section className="panel">
   <div className="workspace-heading"><div><h2>Reporting period</h2><p className="muted">Select the dates for completed work and newly prepared notices. Active balances and open items are current snapshots.</p></div></div>
   <form method="get" className="report-filters"><label>From<input type="date" name="from" defaultValue={dates.from} required/></label><label>Through<input type="date" name="to" defaultValue={dates.to} required/></label><button className="btn" type="submit">Apply period</button></form>
   <p className="muted">Snapshot: {new Date(report.as_of).toLocaleString('en-NG',{timeZone:'Africa/Lagos',dateStyle:'medium',timeStyle:'short'})} WAT</p>
  </section>
  {sections.length?sections.map(section=><section className="panel" key={section.title}>
   <div className="workspace-heading"><div><h2>{section.title}</h2><p className="muted">{section.subtitle}</p></div><Link href={section.href} className="btn secondary">Open workspace</Link></div>
   <div className="audience-kpis">{section.stats.map(([name,value])=><div className="audience-kpi" key={name}><span>{name}</span><strong style={{fontSize:'clamp(1.1rem, 2vw, 1.6rem)',overflowWrap:'anywhere'}}>{value}</strong></div>)}</div>
  </section>):<section className="panel"><h2>No operational sections available</h2><p>Your reporting permission is active, but you have not been granted access to loan, follow-up or notice information.</p></section>}
  <div className="notice"><strong>Bank reporting notice.</strong> This is not a core banking reconciliation or a certified financial statement. Branch restrictions and the original module permissions still apply. Outstanding loan figures come from the internal loan register and must be verified against approved core banking records. Held reminders and approved notice drafts do not mean messages were delivered.</div>
 </WorkspaceShell>;
}
