import {CampaignReportView} from '@/components/campaign-report';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {supabaseServer} from '@/lib/supabase/server';
import {currentAccount} from '@/lib/auth/account';
import {WorkspaceShell} from '@/components/workspace-shell';
import {reportArguments,reportFilters,reportSchema} from '@/lib/analytics/report';
export const dynamic='force-dynamic';
export default async function Reports({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const account=await currentAccount();if(!account)redirect('/login');
 if(!account.permissions.includes('reports.view'))redirect('/dashboard');
 const org=account.workspace.id;
 const raw=await searchParams;
 const params=new URLSearchParams();
 // Reports always use the authenticated bank workspace. Never trust a user-provided org.
 params.set('org',org);
 for(const key of ['from','to','run','page'])if(typeof raw[key]==='string')params.set(key,raw[key]);
 let filters:ReturnType<typeof reportFilters>;
 try{filters=reportFilters(params);}catch{return <WorkspaceShell title="Campaign reports" org={org}>
  <div className="panel"><h2>Check your report filters</h2><p>Use valid dates covering no more than 366 days and a valid campaign run.</p><Link className="btn secondary" href="/dashboard/reports">Reset filters</Link></div>
 </WorkspaceShell>;}
 const db=await supabaseServer();
 // Broadcasts use Resend's own queue, not the legacy recipient-dispatch worker.
 // Do not portray deliberately paused legacy snapshot rows as undelivered email.
 if(filters.run){
  const {data:broadcast,error:broadcastError}=await db.from('charis_resend_broadcast_jobs')
   .select('status,recipient_count,broadcast_id,last_error,created_at')
   .eq('organization_id',org).eq('run_id',filters.run).maybeSingle();
  if(!broadcastError&&broadcast){
   const submitted=broadcast.status==='submitted';
   const state:Record<string,string>={submitted:'Submitted to Resend',ready:'Ready to submit',building:'Preparing',preparing:'Preparing',submitting:'Checking submission',uncertain:'Needs review',failed:'Failed'};
   return <WorkspaceShell title="Broadcast report" org={org} actions={<Link className="btn secondary" href="/dashboard/communications">Communications</Link>}>
    <section className="panel"><h2>{state[broadcast.status]||'Broadcast status'}</h2>
     <div className="audience-kpis"><div className="audience-kpi"><span>Recipients included</span><strong>{broadcast.recipient_count}</strong></div>
     <div className="audience-kpi"><span>Provider submission</span><strong>{submitted?'Accepted':'Not confirmed'}</strong></div></div>
     <p className="muted">{submitted?'Resend accepted the broadcast request.':'Review the provider outcome before taking another action.'} This is not proof of delivery to individual inboxes.</p>
     {broadcast.last_error&&<p role="alert" className="feedback-error">{broadcast.last_error}</p>}
     <p><a className="inline-link" href="https://resend.com/broadcasts" target="_blank" rel="noopener noreferrer">Open Resend broadcasts</a></p>
     <p className="muted">Legacy queue counters are excluded here because this broadcast is processed by Resend, not by the old worker.</p>
    </section>
   </WorkspaceShell>;
  }
 }
 const {data,error}=await db.rpc('campaign_analytics',reportArguments(filters));
 const parsed=reportSchema.safeParse(data);
 if(error||!parsed.success)return <WorkspaceShell org={org} title="Campaign reports"><div className="panel"><h2>Report unavailable</h2><p role="alert">Check that campaign analytics migration 010 is installed and your report permissions are active.</p><Link className="btn secondary" href="/dashboard/reports">Reset filters</Link></div></WorkspaceShell>;
 return <CampaignReportView filters={filters} report={parsed.data}/>;
}
