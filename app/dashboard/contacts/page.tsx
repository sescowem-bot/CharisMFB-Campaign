import Link from 'next/link';
import {redirect} from 'next/navigation';
import {contactsAccess} from '@/lib/contacts/access';
import {WorkspaceShell} from '@/components/workspace-shell';
import {ContactForm} from '@/components/contact-forms';
import {ContactRowActions} from '@/components/contact-row-actions';
import {z} from 'zod';
import {Search,Upload,UserPlus,Users} from 'lucide-react';
import {Callout,EmptyState,Stat,StatusBadge} from '@/components/ui';
export const dynamic='force-dynamic';
export default async function Contacts({searchParams}:{searchParams:Promise<{org?:string;page?:string;q?:string;edit?:string;view?:string}>}){
 const params=await searchParams;
 const org=params.org;
 if(!org)redirect('/dashboard');
 const {db,user,authorized}=await contactsAccess(org);
 if(!user)redirect('/login');if(!authorized)redirect('/dashboard');
 const page=Math.min(1000,Math.max(1,Number.isFinite(Number(params.page))?Math.floor(Number(params.page)):1));
 const q=(params.q||'').trim().slice(0,80).replace(/[%_\\]/g,'');
 const archived=params.view==='archived';
 const pageSize=25;
 let request=db.from('contacts').select('id,first_name,last_name,email,phone,source,consent_status,created_at,archived_at',{count:'exact'}).eq('organization_id',org).order('created_at',{ascending:false}).range((page-1)*pageSize,page*pageSize-1);
 request=archived?request.not('archived_at','is',null):request.is('archived_at',null);
 if(q)request=request.ilike('email',`%${q}%`);
 const {data:contacts,error,count}=await request;
 const editId=z.string().uuid().safeParse(params.edit);
 const {data:editing}=editId.success?await db.from('contacts').select('id,first_name,last_name,email,phone,consent_status,consent_evidence').eq('organization_id',org).eq('id',editId.data).maybeSingle():{data:null};
 const previous=new URLSearchParams({org:org,page:String(page-1)});
 const next=new URLSearchParams({org:org,page:String(page+1)});
 if(q){previous.set('q',q);next.set('q',q);}
 if(archived){previous.set('view','archived');next.set('view','archived');}
 const archivedHref=`/dashboard/contacts?org=${org}&view=archived`;
 return <WorkspaceShell title="Customers" org={org} subtitle="Manage customer contact records and their documented marketing consent." actions={<><Link className="btn secondary" href={`/dashboard/imports?org=${org}`}><Upload size={16}/> Import</Link><Link className="btn" href="#add-customer"><UserPlus size={16}/> Add customer</Link></>}>
  <div className="stat-grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(220px,260px))'}}><Stat label={archived?'Archived customers':'Customers matching'} value={(count||0).toLocaleString()} icon={Users}/></div>
  <div className="toolbar"><Link className={archived?'btn secondary sm':'btn sm'} href={`/dashboard/contacts?org=${org}`}>Active</Link><Link className={archived?'btn sm':'btn secondary sm'} href={archivedHref}>Archived</Link></div>
  <form className="audience-search" method="get"><input type="hidden" name="org" value={org}/>{archived&&<input type="hidden" name="view" value="archived"/>}<label htmlFor="contact-query">Search by email<input id="contact-query" name="q" defaultValue={q} placeholder="customer@example.com"/></label><button type="submit" className="btn secondary"><Search size={16}/> Search</button></form>
  {error&&<Callout tone="danger" alert>Unable to load contacts: {error.message}</Callout>}
  {contacts?.length?<div className="table-scroll"><table className="admin-table"><thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Source</th><th>Marketing consent</th><th>Actions</th></tr></thead><tbody>{contacts.map(c=><tr key={c.id}><td><strong>{[c.first_name,c.last_name].filter(Boolean).join(' ')||'Unnamed contact'}</strong></td><td>{c.email||'—'}</td><td>{c.phone||'—'}</td><td className="muted">{c.source}</td><td><StatusBadge status={c.consent_status}/></td><td><Link className="inline-link" href={`/dashboard/contacts?org=${org}&edit=${c.id}#add-customer`}>Edit</Link><ContactRowActions org={org} id={c.id} archived={Boolean(c.archived_at)}/></td></tr>)}</tbody></table></div>:!error&&<EmptyState icon={Users} title={q?'No customers match your search':'No customers yet'} text="Add a customer manually or import a CSV or Excel file.">{!q&&<Link className="btn" href={`/dashboard/imports?org=${org}`}>Import customers</Link>}</EmptyState>}
  <div className="pagination"><span>Page {page} · {(count||0).toLocaleString()} matching</span><div>{page>1&&<Link className="btn secondary sm" href={`/dashboard/contacts?${previous}`}>Previous</Link>}{page*pageSize<(count||0)&&<Link className="btn secondary sm" href={`/dashboard/contacts?${next}`}>Next</Link>}</div></div>
  <div id="add-customer"><ContactForm key={editing?.id||'new'} org={org} initial={editing||undefined}/>{editing&&<Link href={`/dashboard/contacts?org=${org}`} className="btn secondary">Cancel editing</Link>}</div>
 </WorkspaceShell>;
}
