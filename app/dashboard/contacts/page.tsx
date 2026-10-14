import Link from 'next/link';
import {redirect} from 'next/navigation';
import {contactsAccess} from '@/lib/contacts/access';
import {WorkspaceShell} from '@/components/workspace-shell';
import {ContactForm} from '@/components/contact-forms';
import {CustomerTable} from '@/components/customer-table';
import {z} from 'zod';
export const dynamic='force-dynamic';
export default async function Contacts({searchParams}:{searchParams:Promise<{org?:string;page?:string;q?:string;edit?:string;view?:string;consent?:string}>}){
 const params=await searchParams;
 const org=params.org;
 if(!org)redirect('/dashboard');
 const {db,user,authorized}=await contactsAccess(org);
 if(!user)redirect('/login');if(!authorized)redirect('/dashboard');
 const page=Math.min(1000,Math.max(1,Number.isFinite(Number(params.page))?Math.floor(Number(params.page)):1));
 const q=(params.q||'').trim().slice(0,80).replace(/[^a-zA-Z0-9 @.+-]/g,'');
 const archived=params.view==='archived';
 const consent=['unknown','granted','denied'].includes(params.consent||'')?params.consent||'':'';
 const pageSize=25;
 let request=db.from('contacts').select('id,first_name,last_name,email,phone,source,consent_status,created_at,archived_at',{count:'exact'}).eq('organization_id',org).order('created_at',{ascending:false}).range((page-1)*pageSize,page*pageSize-1);
 request=archived?request.not('archived_at','is',null):request.is('archived_at',null);
 if(consent)request=request.eq('consent_status',consent);
 if(q)request=request.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
 const {data:contacts,error,count}=await request;
 const editId=z.string().uuid().safeParse(params.edit);
 const {data:editing}=editId.success?await db.from('contacts').select('id,first_name,last_name,email,phone,consent_status,consent_evidence,attributes').eq('organization_id',org).eq('id',editId.data).maybeSingle():{data:null};
 const previous=new URLSearchParams({org:org,page:String(page-1)});
 const next=new URLSearchParams({org:org,page:String(page+1)});
 if(q){previous.set('q',q);next.set('q',q);}
 if(consent){previous.set('consent',consent);next.set('consent',consent);}
 if(archived){previous.set('view','archived');next.set('view','archived');}
 return <WorkspaceShell title="Contacts & audiences" org={org}><p className="muted">View and manage customer records, communication permission and saved groups. Adding a customer does not automatically mean they agreed to promotional emails.</p><div className="workspace-links"><Link href={`/dashboard/imports?org=${org}`}>Import CSV / Excel</Link><Link href={`/dashboard/lists?org=${org}`}>Contact lists</Link><Link href={`/dashboard/segments?org=${org}`}>Dynamic segments</Link></div><div className="workspace-links"><Link href={`/dashboard/contacts?org=${org}`}>Active customers</Link><Link href={`/dashboard/contacts?org=${org}&view=archived`}>Archived customers</Link></div><div className="audience-kpis"><div className="audience-kpi"><span>Contacts matching search</span><strong>{(count||0).toLocaleString()}</strong></div><div className="audience-kpi"><span>Rows per page</span><strong>{pageSize}</strong></div></div><form className="audience-search" method="get"><input type="hidden" name="org" value={org}/><label htmlFor="contact-query">Search by name, email or phone</label>{archived&&<input type="hidden" name="view" value="archived"/>}<input id="contact-query" name="q" defaultValue={q} placeholder="Name, email or phone"/><label htmlFor="consent-filter">Marketing permission</label><select id="consent-filter" name="consent" defaultValue={consent}><option value="">Everyone</option><option value="unknown">Not confirmed</option><option value="granted">Agreed</option><option value="denied">Opted out</option></select><button type="submit" className="btn secondary">Search</button></form>{error&&<p role="alert" className="feedback-error">Unable to load contacts: {error.message}</p>}<p className="muted">To update one customer’s marketing permission, choose Edit in the table and record the evidence of their choice. Previously opted-out customers cannot be resubscribed through an ordinary edit.</p><CustomerTable org={org} people={contacts||[]}/>{!contacts?.length&&!error&&<p className="muted">No contacts found. Add one manually or import a CSV / Excel file.</p>}<div className="pagination"><span>Page {page} · {count||0} matching</span><div>{page>1&&<Link className="btn secondary" href={`/dashboard/contacts?${previous}`}>Previous</Link>}{page*pageSize<(count||0)&&<Link className="btn secondary" href={`/dashboard/contacts?${next}`}>Next</Link>}</div></div><ContactForm key={editing?.id||'new'} org={org} initial={editing||undefined}/>{editing&&<Link href={`/dashboard/contacts?org=${org}`} className="btn secondary">Cancel editing</Link>}</WorkspaceShell>;
}
