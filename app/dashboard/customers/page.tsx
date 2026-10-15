import {redirect} from 'next/navigation';
import {z} from 'zod';
import {supabaseServer} from '@/lib/supabase/server';
import {currentAccount} from '@/lib/auth/account';
import {WorkspaceShell} from '@/components/workspace-shell';
export const dynamic='force-dynamic';
export default async function CustomerWorkspace({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}){
 const account=await currentAccount();if(!account)redirect('/login');
 if(!account.permissions.some(p=>p==='customers.view'||p==='customers.manage'))redirect('/dashboard');
 const {q='',page='1'}=await searchParams;
 const safeQuery=q.trim().replace(/[^a-zA-Z0-9 .@+-]/g,'').slice(0,75);
 const parsed=z.coerce.number().int().min(1).max(200).safeParse(page);
 const current=parsed.success?parsed.data:1;const org=account.workspace.id;const db=await supabaseServer();
 let request=db.from('contacts').select('id,first_name,last_name,email,phone,consent_status',{count:'exact'})
  .eq('organization_id',org).is('archived_at',null).order('created_at',{ascending:false}).range((current-1)*25,current*25-1);
 if(safeQuery)request=request.or(`first_name.ilike.%${safeQuery}%,last_name.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%,phone.ilike.%${safeQuery}%`);
 const {data,error,count}=await request;
 const ids=(data||[]).map(c=>c.id);
 const [{data:locations},{data:branches}]=ids.length?await Promise.all([
  db.from('charis_customer_locations').select('contact_id,branch_id').eq('organization_id',org).in('contact_id',ids),
  db.from('charis_branches').select('id,name').eq('organization_id',org)
 ]):[{data:[]},{data:[]}];
 const assigned=new Map((locations||[]).map(x=>[x.contact_id,x.branch_id]));
 const branchNames=new Map((branches||[]).map(x=>[x.id,x.name]));
 return <WorkspaceShell title="Customer workspace" org={org} subtitle="Only customers your account is authorised to view appear here.">
  <section className="panel"><form method="get" className="audience-search"><label>Find customer<input name="q" defaultValue={safeQuery} placeholder="Name, phone or email"/></label><button type="submit" className="btn secondary">Search</button></form></section>
  {error&&<p role="alert" className="feedback-error">The customer directory is unavailable. Contact your administrator.</p>}
  {!error&&<section className="panel"><div className="table-scroll"><table className="admin-table"><thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Branch</th><th>Marketing choice</th></tr></thead><tbody>
   {(data||[]).map(c=><tr key={c.id}><td>{[c.first_name,c.last_name].filter(Boolean).join(' ')||'Unnamed customer'}</td><td>{c.email||'—'}</td><td>{c.phone||'—'}</td><td>{branchNames.get(assigned.get(c.id)||'')||'Not allocated'}</td><td>{c.consent_status==='granted'?'Agreed':c.consent_status==='denied'?'Declined':'Not confirmed'}</td></tr>)}
  </tbody></table></div>{!data?.length&&<p className="muted">No customers match your authorised access.</p>}
  <nav className="actions" aria-label="Customer pages"><span>Page {current} · {count||0} customers</span>
   {current>1&&<a className="btn secondary" href={`/dashboard/customers?page=${current-1}&q=${encodeURIComponent(safeQuery)}`}>Previous</a>}
   {current*25<(count||0)&&<a className="btn secondary" href={`/dashboard/customers?page=${current+1}&q=${encodeURIComponent(safeQuery)}`}>Next</a>}</nav></section>}
 </WorkspaceShell>;
}
