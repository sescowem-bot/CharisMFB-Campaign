import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {contactsAccess} from '@/lib/contacts/access';
import {WorkspaceShell} from '@/components/workspace-shell';

export const dynamic='force-dynamic';
const PAGE_SIZE=50;
const isUuid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export default async function ContactGroupDetails({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{org?:string;page?:string}>}){
 const [{id},{org,page:pageValue}]=await Promise.all([params,searchParams]);
 if(!org)redirect('/dashboard');
 if(!isUuid(id))notFound();
 const {db,user,authorized}=await contactsAccess(org);
 if(!user)redirect('/login');
 if(!authorized)redirect('/dashboard');
 const {data:group,error:groupError}=await db.from('contact_lists').select('id,name,description,created_at').eq('id',id).eq('organization_id',org).maybeSingle();
 if(groupError||!group)notFound();
 const requestedPage=Number.parseInt(pageValue||'1',10);
 const page=Number.isFinite(requestedPage)?Math.max(1,requestedPage):1;
 const start=(page-1)*PAGE_SIZE;
 const {data:members,error:memberError,count}=await db.from('contact_list_members').select('contact_id',{count:'exact'}).eq('organization_id',org).eq('list_id',id).order('contact_id',{ascending:true}).range(start,start+PAGE_SIZE-1);
 const total=count??members?.length??0;
 const totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));
 const contactIds=(members||[]).map(member=>member.contact_id);
 const {data:contacts,error:contactError}=contactIds.length
  ?await db.from('contacts').select('id,first_name,last_name,email,phone,archived_at').eq('organization_id',org).in('id',contactIds)
  :{data:[],error:null};
 const contactById=new Map((contacts||[]).map(contact=>[contact.id,contact]));
 return <WorkspaceShell title={group.name} subtitle="Saved customer group">
  <div className="charis-group-toolbar"><Link href="/dashboard/lists" className="btn secondary">← Back to groups</Link><Link href="/dashboard/communications/new" className="btn">Create campaign</Link></div>
  <section className="charis-group-summary" aria-label="Group information">
   <div><span className="muted">Group description</span><p>{group.description||'No description added.'}</p></div>
   <div><span className="muted">Total members</span><strong>{total.toLocaleString('en-NG')}</strong></div>
  </section>
  <div className="charis-group-members-head"><div><h2>Group members</h2><p className="muted">Showing {total===0?0:start+1}–{Math.min(start+PAGE_SIZE,total)} of {total.toLocaleString('en-NG')} members</p></div></div>
  {memberError?<p className="feedback-error" role="alert">Group members could not be loaded. Please try again.</p>:
   contactError?<p className="feedback-error" role="alert">Contact details could not be loaded. Please try again.</p>:
   total===0?<div className="charis-group-empty"><strong>This group has no members yet.</strong><p className="muted">Add customers from the Contact Groups page or include a group when importing contacts.</p></div>:
   <div className="table-scroll"><table className="admin-table"><thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Status</th></tr></thead><tbody>
    {(members||[]).map(member=>{const contact=contactById.get(member.contact_id);const name=contact?[contact.first_name,contact.last_name].filter(Boolean).join(' ')||'Customer':'Contact unavailable';return <tr key={member.contact_id}><td>{name}</td><td>{contact?.email||'—'}</td><td>{contact?.phone||'—'}</td><td>{!contact?'Unavailable':contact.archived_at?'Archived':'Active'}</td></tr>;})}
   </tbody></table></div>}
  {totalPages>1&&<nav className="pagination" aria-label="Group member pages"><span>Page {page} of {totalPages}</span><div>
   {page>1&&<Link className="btn secondary" href={page===2?'/dashboard/lists/'+id:'/dashboard/lists/'+id+'?page='+(page-1)}>Previous</Link>}
   {page<totalPages&&<Link className="btn secondary" href={'/dashboard/lists/'+id+'?page='+(page+1)}>Next</Link>}
  </div></nav>}
 </WorkspaceShell>;
}
