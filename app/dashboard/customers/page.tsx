import Link from 'next/link';
import {redirect} from 'next/navigation';
import {z} from 'zod';
import {supabaseServer} from '@/lib/supabase/server';
import {currentAccount} from '@/lib/auth/account';
import {WorkspaceShell} from '@/components/workspace-shell';
export const dynamic='force-dynamic';
export default async function CustomerWorkspace({searchParams}:{searchParams:Promise<{q?:string;page?:string;consent?:string;channel?:string}>}){
 const account=await currentAccount();if(!account)redirect('/login');
 if(!account.permissions.some(p=>p==='customers.view'||p==='customers.manage'))redirect('/dashboard');
 const {q='',page='1',consent='',channel='all'}=await searchParams;
 const safeQuery=q.trim().replace(/[^a-zA-Z0-9 .@+-]/g,'').slice(0,75);
 const selectedConsent=['granted','denied','unknown'].includes(consent)?consent:'';
 const selectedChannel=['all','email','sms','no_contact'].includes(channel)?channel:'all';
 const parsed=z.coerce.number().int().min(1).max(200).safeParse(page);
 const current=parsed.success?parsed.data:1;const org=account.workspace.id;const db=await supabaseServer();
 let request=db.from('contacts').select('id,first_name,last_name,email,phone,consent_status',{count:'exact'})
  .eq('organization_id',org).is('archived_at',null).order('created_at',{ascending:false}).range((current-1)*25,current*25-1);
 if(safeQuery)request=request.or(`first_name.ilike.%${safeQuery}%,last_name.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%,phone.ilike.%${safeQuery}%`);
 if(selectedConsent)request=request.eq('consent_status',selectedConsent);
 if(selectedChannel==='email')request=request.not('email','is',null);
 if(selectedChannel==='sms')request=request.not('phone','is',null);
 if(selectedChannel==='no_contact')request=request.is('email',null).is('phone',null);
 const {data,error,count}=await request;
 const ids=(data||[]).map(c=>c.id);
 const [{data:locations},{data:branches}]=ids.length?await Promise.all([
  db.from('charis_customer_locations').select('contact_id,branch_id').eq('organization_id',org).in('contact_id',ids),
  db.from('charis_branches').select('id,name').eq('organization_id',org)
 ]):[{data:[]},{data:[]}];
 const assigned=new Map((locations||[]).map(x=>[x.contact_id,x.branch_id]));
 const branchNames=new Map((branches||[]).map(x=>[x.id,x.name]));
 const link=(p:number)=>{const x=new URLSearchParams({page:String(p)});if(safeQuery)x.set('q',safeQuery);if(selectedConsent)x.set('consent',selectedConsent);if(selectedChannel!=='all')x.set('channel',selectedChannel);return `/dashboard/customers?${x}`;};
 return <WorkspaceShell title="Customer workspace" org={org} subtitle="Search customers within your authorised branch access; filtering does not change marketing consent.">
  <section className="panel"><form method="get" className="audience-search">
   <label>Find customer<input name="q" defaultValue={safeQuery} placeholder="Name, phone or email"/></label>
   <label>Marketing permission<select name="consent" defaultValue={selectedConsent}><option value="">All choices</option><option value="granted">Agreed</option><option value="unknown">Not confirmed</option><option value="denied">Declined</option></select></label>
   <label>Contact details<select name="channel" defaultValue={selectedChannel}><option value="all">Any</option><option value="email">Has email</option><option value="sms">Has phone</option><option value="no_contact">Neither available</option></select></label>
   <button type="submit" className="btn secondary">Filter</button><Link href="/dashboard/customers" className="btn secondary">Reset</Link>
  </form></section>
  {error&&<p role="alert" className="feedback-error">The customer directory is unavailable. Contact your administrator.</p>}
  {!error&&<section className="panel"><div className="table-scroll"><table className="admin-table"><thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Branch</th><th>Marketing choice</th></tr></thead><tbody>
   {(data||[]).map(c=><tr key={c.id}><td>{[c.first_name,c.last_name].filter(Boolean).join(' ')||'Unnamed customer'}</td><td>{c.email||'—'}</td><td>{c.phone||'—'}</td><td>{branchNames.get(assigned.get(c.id)||'')||'Not allocated'}</td><td>{c.consent_status==='granted'?'Agreed':c.consent_status==='denied'?'Declined':'Not confirmed'}</td></tr>)}
  </tbody></table></div>{!data?.length&&<p className="muted">No customers match your filters and authorised access.</p>}
  <nav className="actions" aria-label="Customer pages"><span>Page {current} · {count||0} matching customers</span>
   {current>1&&<Link className="btn secondary" href={link(current-1)}>Previous</Link>}
   {current*25<(count||0)&&<Link className="btn secondary" href={link(current+1)}>Next</Link>}</nav>
  <p className="muted">Customer contact information does not establish promotional consent. Messages must still follow the approved communication workflow.</p></section>}
 </WorkspaceShell>;
}
