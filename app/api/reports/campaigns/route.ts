import {supabaseServer} from '@/lib/supabase/server';
import {currentAccount} from '@/lib/auth/account';
import {reportArguments,reportCsv,reportFilters,reportSchema} from '@/lib/analytics/report';
export const runtime='nodejs';
export async function GET(request:Request){
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
 try{
  const account=await currentAccount();
  if(!account)return Response.json({error:'Verified staff sign-in required'},{status:401,headers});
  if(!account.permissions.includes('reports.view'))return Response.json({error:'Reporting access denied'},{status:403,headers});
  const params=new URL(request.url).searchParams;
  // Reports are for the bank associated with the verified server session,
  // never an org ID in an arbitrary query string.
  params.set('org',account.workspace.id);
  let filters:ReturnType<typeof reportFilters>;
  try{filters=reportFilters(params);}catch{return Response.json({error:'Invalid date range or report filter. Use up to 366 days.'},{status:400,headers});}
  const db=await supabaseServer();
  const {data,error}=await db.rpc('campaign_analytics',reportArguments(filters,true));
  if(error)return Response.json({error:'Report unavailable. Check the selected run and database setup.'},{status:400,headers});
  const report=reportSchema.safeParse(data);
  if(!report.success)return Response.json({error:'Report data unavailable'},{status:503,headers});
  return new Response(reportCsv(report.data),{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="campaign-report-${filters.from}-${filters.to}.csv"`,'X-Report-Total-Runs':String(report.data.total_runs),'X-Report-Exported-Runs':String(report.data.runs.length)}});
 }catch{return Response.json({error:'Report service unavailable'},{status:503,headers});}
}
