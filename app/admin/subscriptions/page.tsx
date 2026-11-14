import Link from 'next/link';
import {redirect} from 'next/navigation';
import {currentAccount} from '@/lib/auth/account';
import {emailServiceDb} from '@/lib/email/server';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
import {SubscriptionStaffForm} from '@/components/subscription-admin-forms';
export const dynamic='force-dynamic';
export default async function SubscriptionAdmin({searchParams}:{searchParams:Promise<{q?:string}>}){
 const account=await currentAccount();if(!account)redirect('/login');
 const org=account.workspace.id,db=await supabaseServer();
 const [{data:canView},{data:isAdmin}]=await Promise.all([
  db.rpc('charis_subscription_can',{p_org:org,p_action:'view'}),
  db.rpc('charis_direct_is_admin',{p_org:org})
 ]);
 if(!canView&&!isAdmin)redirect('/dashboard/communications');
 const {q=''}=await searchParams,search=q.trim().toLowerCase(),service=emailServiceDb();
 const [optouts,team,roles]=await Promise.all([
  search.length>=3
   ?service.from('contacts').select('id,email,first_name,last_name,consent_status,unsubscribed_at').eq('organization_id',org).eq('email',search).limit(3)
   :service.from('contacts').select('id,email,first_name,last_name,consent_status,unsubscribed_at').eq('organization_id',org).not('unsubscribed_at','is',null).order('updated_at',{ascending:false}).limit(50),
  isAdmin?db.rpc('charis_access_staff_list',{p_org:org}):Promise.resolve({data:[]}),
  isAdmin?service.from('charis_subscription_staff_access').select('user_id,can_view').eq('organization_id',org):Promise.resolve({data:[]})
 ]);
 const contacts=(optouts.data||[]).filter(c=>!!c.email),emails=contacts.map(c=>c.email as string);
 const {data:blocks}=emails.length?await service.from('email_suppressions').select('email,reason').eq('organization_id',org).in('email',emails):{data:[]};
 const statusFor=(email:string,unsubscribedAt:string|null,consent:string)=>{
  const block=(blocks||[]).find(s=>s.email===email);
  if(block?.reason&&block.reason!=='unsubscribe')return 'Delivery blocked';
  if(unsubscribedAt||block?.reason==='unsubscribe')return 'Unsubscribed';
  return consent==='granted'?'Consent recorded':'Not recorded';
 };
 const staff=Array.isArray(team.data)?team.data as {id:string;email:string}[]:[];
 return <WorkspaceShell title="Email preferences" subtitle="Review customer email opt-outs and staff access." actions={<Link href="/admin/communications" className="btn secondary">Back to settings</Link>}>
  <section className="panel"><h2>Customer email preferences</h2><p className="muted">Customers can unsubscribe from future campaign updates at any time. No separate customer sign-up is required.</p>
   <form method="get" className="admin-form" action="/admin/subscriptions"><label>Find a customer by email<input type="search" name="q" defaultValue={q} placeholder="Enter exact email address"/></label><button className="btn secondary">Search</button></form>
   <div className="table-scroll"><table className="admin-table"><thead><tr><th>Customer</th><th>Email</th><th>Email status</th></tr></thead><tbody>
    {contacts.map(c=><tr key={c.id}><td>{[c.first_name,c.last_name].filter(Boolean).join(' ')||'Customer'}</td><td>{c.email}</td><td>{statusFor(c.email as string,c.unsubscribed_at,c.consent_status)}</td></tr>)}
   </tbody></table></div>
   {!contacts.length&&<p className="muted">No matching customers.</p>}
  </section>
  {isAdmin&&<section className="panel"><SubscriptionStaffForm staff={staff} roles={roles.data||[]}/></section>}
 </WorkspaceShell>;
}
