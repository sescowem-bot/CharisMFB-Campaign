import Link from 'next/link';
import {redirect} from 'next/navigation';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
import {parseOperationalDates} from '@/lib/charis-operational-insights';
export const dynamic='force-dynamic';

type Params={from?:string;to?:string;category?:string;page?:string};
const categories=[
 {key:'all',label:'All activity',prefix:''},
 {key:'credit',label:'Credit operations',prefix:'credit.'},
 {key:'loans',label:'Loan activity',prefix:'loan.'},
 {key:'access',label:'Staff and access',prefix:'access.'},
 {key:'campaigns',label:'Campaign decisions',prefix:'campaign.'}
] as const;
export default async function Audit({searchParams}:{searchParams:Promise<Params>}){
 const account=await currentAccount();if(!account)redirect('/login');
 if(!account.permissions.includes('audit.view'))redirect('/dashboard');
 const org=account.workspace.id;
 const params=await searchParams,dates=parseOperationalDates(params.from,params.to);
 const category=categories.find(c=>c.key===params.category)||categories[0];
 const pageValue=Number(params.page||'1');
 const page=Number.isInteger(pageValue)&&pageValue>=1&&pageValue<=100?pageValue:1;
 const queryFor=(p:number)=>{const q=new URLSearchParams({page:String(p),category:category.key});if(dates){q.set('from',dates.from);q.set('to',dates.to);}return '/admin/audit?'+q.toString();};
 if(!dates)return <WorkspaceShell title="Audit activity" org={org} admin><section className="panel"><h2>Invalid date range</h2><p>Use a valid date range up to 366 days.</p><Link href="/admin/audit" className="btn secondary">Reset filters</Link></section></WorkspaceShell>;
 const db=await supabaseServer();
 let query=db.from('audit_logs').select('id,actor_id,action,entity_type,created_at')
  .eq('organization_id',org)
  .gte('created_at',dates.p_from).lt('created_at',dates.p_until)
  .order('created_at',{ascending:false}).order('id',{ascending:false})
  .range((page-1)*50,page*50);
 if(category.prefix)query=query.like('action',`${category.prefix}%`);
 const {data,error}=await query;
 const rows=(data||[]).slice(0,50),hasNext=(data||[]).length>50;
 return <WorkspaceShell title="Audit activity" org={org} admin subtitle="Review authorised changes, approvals and staff access decisions.">
  <section className="panel"><h2>Find activity</h2><form method="get" className="report-filters">
   <label>Activity type<select name="category" defaultValue={category.key}>{categories.map(c=><option value={c.key} key={c.key}>{c.label}</option>)}</select></label>
   <label>From<input name="from" type="date" defaultValue={dates.from} required/></label>
   <label>Through<input name="to" type="date" defaultValue={dates.to} required/></label>
   <button className="btn" type="submit">Apply filters</button></form>
   <p className="muted">Shows up to 50 records per page. Individual customer data and private message bodies are intentionally excluded.</p>
  </section>
  {error?<section className="panel"><p role="alert" className="feedback-error">Audit activity is temporarily unavailable. Ask a system administrator to check access.</p></section>:
   <section className="panel"><div className="workspace-heading"><h2>Recorded events</h2><span className="muted">Page {page} · {rows.length} entries</span></div>
    {rows.length?<div className="table-scroll"><table className="admin-table"><thead><tr><th>Time (WAT)</th><th>Action</th><th>Performed by</th><th>Record type</th></tr></thead><tbody>{rows.map(e=><tr key={e.id}>
     <td>{new Date(e.created_at).toLocaleString('en-NG',{timeZone:'Africa/Lagos',dateStyle:'medium',timeStyle:'short'})}</td>
     <td>{e.action.replaceAll(/[._]/g,' ')}</td><td>{e.actor_id?`Staff ID ${e.actor_id.slice(0,8)}…`:'System'}</td><td>{e.entity_type}</td>
    </tr>)}</tbody></table></div>:<p className="muted">No audit records matched the selected period and activity type.</p>}
    <nav className="actions" aria-label="Audit log pages">{page>1&&<Link href={queryFor(page-1)} className="btn secondary">Previous</Link>}{hasNext&&page<100&&<Link href={queryFor(page+1)} className="btn secondary">Next</Link>}</nav>
   </section>}
  <p className="muted">Audit logs are restricted to staff with audit permissions. These records are not editable from this page.</p>
 </WorkspaceShell>;
}
