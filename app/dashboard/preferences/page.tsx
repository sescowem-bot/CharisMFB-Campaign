import Link from 'next/link';
import {redirect} from 'next/navigation';
import {z} from 'zod';
import {WorkspaceShell} from '@/components/workspace-shell';
import {contactsAccess} from '@/lib/contacts/access';

/** This is a READ-ONLY staff review. It does not lift a suppression or change permissions. */
export const dynamic='force-dynamic';
const views = [
 {id:'unsubscribed',label:'Unsubscribed from promotions'},
 {id:'declined',label:'Declined promotions'},
 {id:'not-confirmed',label:'Permission not confirmed'},
 {id:'agreed',label:'Agreed to promotions'},
 {id:'blocked',label:'Email delivery blocked'}
] as const;
type View = typeof views[number]['id'];
type PreferenceRow = {email:string;name:string;reason:string;date:string|null;id:string|null};

export default async function CommunicationPreferences({searchParams}:{searchParams:Promise<{org?:string;view?:string;page?:string}>}) {
 const params=await searchParams;
 const parsed=z.string().uuid().safeParse(params.org);
 if(!parsed.success)redirect('/dashboard');
 const org=parsed.data;
 const {db,user,authorized}=await contactsAccess(org);
 if(!user)redirect('/login');
 if(!authorized)redirect('/dashboard');
 const view:View=views.find(v=>v.id===params.view)?.id||'unsubscribed';
 const page=Math.min(1000,Math.max(1,Number(params.page)||1));
 const pageSize=25;
 const start=(page-1)*pageSize;
 const end=start+pageSize-1;

 const [unsubscribeCount,declinedCount,unknownCount,agreedCount,blockedCount]=await Promise.all([
  db.from('email_suppressions').select('email',{count:'exact',head:true}).eq('organization_id',org).eq('reason','unsubscribe'),
  db.from('contacts').select('id',{count:'exact',head:true}).eq('organization_id',org).eq('consent_status','denied').is('unsubscribed_at',null),
  db.from('contacts').select('id',{count:'exact',head:true}).eq('organization_id',org).eq('consent_status','unknown'),
  db.from('contacts').select('id',{count:'exact',head:true}).eq('organization_id',org).eq('consent_status','granted'),
  db.from('email_suppressions').select('email',{count:'exact',head:true}).eq('organization_id',org).in('reason',['bounce','complaint','blocked'])
 ]);
 const counts:Record<View,number|undefined>={
  'unsubscribed':unsubscribeCount.count??undefined,'declined':declinedCount.count??undefined,
  'not-confirmed':unknownCount.count??undefined,'agreed':agreedCount.count??undefined,
  'blocked':blockedCount.count??undefined
 };
 let rows:PreferenceRow[]=[];
 let count:number|null=null;
 let loadError='';
 if(view==='unsubscribed'||view==='blocked'){
  let query=db.from('email_suppressions').select('email,reason,created_at',{count:'exact'})
   .eq('organization_id',org).order('created_at',{ascending:false}).range(start,end);
  query=view==='unsubscribed'?query.eq('reason','unsubscribe'):query.in('reason',['bounce','complaint','blocked']);
  const result=await query;
  if(result.error)loadError='Could not load the email preference records.';
  else{
   count=result.count;
   const items=result.data||[];
   const addresses=[...new Set(items.map(r=>r.email))];
   const contactResult=addresses.length?await db.from('contacts').select('id,email,first_name,last_name').eq('organization_id',org).in('email',addresses):{data:[],error:null};
   const matching=new Map((contactResult.data||[]).map(c=>[String(c.email).toLowerCase(),c]));
   rows=items.map(item=>{
    const customer=matching.get(item.email.toLowerCase());
    return {email:item.email,name:customer?[customer.first_name,customer.last_name].filter(Boolean).join(' ')||'Customer':'—',
     reason:item.reason==='unsubscribe'?'Unsubscribed from promotions':item.reason==='complaint'?'Spam complaint':item.reason==='bounce'?'Email bounced':'Provider blocked email',
     date:item.created_at,id:customer?.id||null};
   });
  }
 }else{
  let query=db.from('contacts').select('id,email,first_name,last_name,consent_status,unsubscribed_at,created_at',{count:'exact'})
   .eq('organization_id',org).order('created_at',{ascending:false}).range(start,end);
  query=view==='declined'?query.eq('consent_status','denied').is('unsubscribed_at',null):
   query.eq('consent_status',view==='agreed'?'granted':'unknown');
  const result=await query;
  if(result.error)loadError='Could not load customer preferences.';
  else{
   count=result.count;
   rows=(result.data||[]).map(c=>({id:c.id,email:c.email||'No email address',
    name:[c.first_name,c.last_name].filter(Boolean).join(' ')||'Unnamed customer',
    reason:view==='declined'?'Promotional messages declined':view==='agreed'?'Agreement recorded':'Permission not confirmed',
    date:view==='declined'?c.unsubscribed_at:c.created_at}));
  }
 }
 const total=count??0;
 const current=views.find(v=>v.id===view)!;
 const href=(tab:View,p=1)=>`/dashboard/preferences?org=${encodeURIComponent(org)}&view=${tab}&page=${p}`;
 return <WorkspaceShell title="Customer communication preferences" org={org}>
  <p className="muted">Charis serves existing account holders. A customer can remain an account holder while declining optional promotional emails. These settings do not delete banking records.</p>
  <section className="panel"><h2>What can Charis send?</h2>
   <div className="form-two"><div><h3>Account and security notices</h3><p className="muted">Important account or security messages may be sent where a lawful basis applies and the bank has approved their purpose. This campaign system does not yet provide a separate service-notice sending workflow.</p></div>
   <div><h3>Promotions and offers</h3><p className="muted">Only send promotional emails where marketing permission is documented, and respect every unsubscribe, refusal and delivery block.</p></div></div>
   <p className="muted">Staff cannot remove a customer from this list merely to make a campaign send. A genuinely renewed opt-in requires a separate approved process and evidence.</p>
  </section>
  <section className="panel"><h2>Review communication preferences</h2>
   <div className="audience-kpis">{views.map(v=><Link className="audience-kpi" key={v.id} href={href(v.id)} aria-current={v.id===view?'page':undefined}><span>{v.label}</span><strong>{counts[v.id]===undefined?'—':counts[v.id]!.toLocaleString()}</strong></Link>)}</div>
   <h3>{current.label}</h3>
   {view==='unsubscribed'&&<p className="muted">These email addresses explicitly unsubscribed through campaign links or provider notifications. They must not receive promotional email.</p>}
   {view==='declined'&&<p className="muted">Customers marked as declining promotional emails, excluding separately logged unsubscribe requests. A declined status may also be set by authorised staff.</p>}
   {view==='blocked'&&<p className="muted">A bounced email, spam complaint or provider block is a delivery restriction, not proof that someone requested to unsubscribe.</p>}
   {view==='agreed'&&<p className="muted">Documented agreement alone does not guarantee send eligibility; archived records, unsubscribes and provider blocks still take precedence.</p>}
   {view==='not-confirmed'&&<p className="muted">Having a bank account or being on an imported list does not by itself establish promotional email consent.</p>}
   {loadError&&<p role="alert" className="feedback-error">{loadError}</p>}
   {!loadError&&<div className="table-scroll"><table className="admin-table"><thead><tr><th scope="col">Customer</th><th scope="col">Email address</th><th scope="col">Status / reason</th><th scope="col">Recorded</th><th scope="col">Customer record</th></tr></thead><tbody>
   {rows.map((r,i)=><tr key={`${r.email}-${r.id||i}`}><td>{r.name}</td><td>{r.email}</td><td>{r.reason}</td><td>{r.date?new Date(r.date).toLocaleDateString('en-NG'):'—'}</td><td>{r.id?<Link href={`/dashboard/contacts?org=${org}&edit=${r.id}`}>View customer</Link>:'Not in current contacts'}</td></tr>)}
   </tbody></table></div>}
   {!loadError&&rows.length===0&&<p className="muted">No records in this category.</p>}
   <div className="pagination"><span>Page {page} · {total.toLocaleString()} records</span><div>{page>1&&<Link className="btn secondary" href={href(view,page-1)}>Previous</Link>}{page*pageSize<total&&<Link className="btn secondary" href={href(view,page+1)}>Next</Link>}</div></div>
  </section>
  <div className="workspace-links"><Link className="btn secondary" href={`/dashboard/contacts?org=${org}`}>Manage bank customers</Link><Link className="btn secondary" href={`/dashboard/imports?org=${org}`}>Import new customers</Link></div>
 </WorkspaceShell>;
}
