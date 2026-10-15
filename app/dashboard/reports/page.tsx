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
 const {data,error}=await db.rpc('campaign_analytics',reportArguments(filters));
 const parsed=reportSchema.safeParse(data);
 if(error||!parsed.success)return <WorkspaceShell org={org} title="Campaign reports"><div className="panel"><h2>Report unavailable</h2><p role="alert">Check that campaign analytics migration 010 is installed and your report permissions are active.</p><Link className="btn secondary" href="/dashboard/reports">Reset filters</Link></div></WorkspaceShell>;
 return <CampaignReportView filters={filters} report={parsed.data}/>;
}
