import Link from 'next/link';
import {redirect} from 'next/navigation';
import {currentAccount} from '@/lib/auth/account';
import {emailServiceDb} from '@/lib/email/server';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
import {SubscriptionInviteForm,SubscriptionStaffForm} from '@/components/subscription-admin-forms';
export const dynamic='force-dynamic';
export default async function SubscriptionAdmin({searchParams}:{searchParams:Promise<{q?:string}>}){
 const account=await currentAccount();if(!account)redirect('/login');
 const org=account.workspace.id,db=await supabaseServer();
 const [{data:canView},{data:canInvite},{data:isAdmin}]=await Promise.all([
  db.rpc('charis_subscription_can',{p_org:org,p_action:'view'}),db.rpc('charis_subscription_can',{p_org:org,p_action:'invite'}),db.rpc('charis_direct_is_admin',{p_org:org})]);
 if(!canView&&!canInvite&&!isAdmin)redirect('/dashboard/communications');
 const {q=''}=await searchParams;const search=q.trim().toLowerCase();
 const service=emailServiceDb();
 const [optouts,team,roles]=await Promise.all([
  search.length>=3?service.from('contacts').select('id,email,first_name,last_name,consent_status,unsubscribed_at')
   .eq('organization_id',org).eq('email',search).limit(3)
  :service.from('contacts').select('id,email,first_name,last_name,consent_status,unsubscribed_at')
   .eq('organization_id',org).not('unsubscribed_at','is',null).order('updated_at',{ascending:false}).limit(35),
  isAdmin?db.rpc('charis_access_staff_list',{p_org:org}):Promise.resolve({data:[]}),
  isAdmin?service.from('charis_subscription_staff_access').select('user_id,can_view,can_invite').eq('organization_id',org):Promise.resolve({data:[]})
 ]);
 const contacts=(optouts.data||[]).filter(c=>!!c.email);
 const emails=contacts.map(c=>c.email as string);
 const [blocks,requests,syncs]=emails.length?await Promise.all([
  service.from('email_suppressions').select('email,reason').eq('organization_id',org).in('email',emails),
  service.from('charis_resubscribe_requests').select('email,created_at,verified_at,delivery_state').eq('organization_id',org).in('email',emails).order('created_at',{ascending:false}).limit(80),
  service.from('charis_subscription_sync').select('email,status,desired_unsubscribed').eq('organization_id',org).in('email',emails)
 ]):[{data:[]},{data:[]},{data:[]}];
 const statusFor=(email:string,unsubscribed_at:string|null,consent:string)=>{
  const block=(blocks.data||[]).find(s=>s.email===email);
  const request=(requests.data||[]).find(r=>r.email===email);
  const sync=(syncs.data||[]).find(s=>s.email===email);
  if(block?.reason&&block.reason!=='unsubscribe')return 'Delivery blocked';
  if(unsubscribed_at||block?.reason==='unsubscribe')return 'Unsubscribed';
  if(request?.verified_at&&sync?.status!=='synced'&&!sync?.desired_unsubscribed)return 'Re-subscribed · Provider sync pending';
  return consent==='granted'?'Subscribed':'No recorded opt-in';
 };
 const staff=Array.isArray(team.data)?team.data as {id:string;email:string}[]:[];
 return <WorkspaceShell title="Email subscriptions" subtitle="Customer preferences and staff access." actions={<Link href="/admin/communications" className="btn secondary">Back to settings</Link>}>
 <section className="panel"><h2>Subscription status</h2><p className="muted">Charis records are shown below. An unsubscribe made in an older Resend Broadcast may appear only in Resend until synchronised.</p>
 <form method="get" className="admin-form" action="/admin/subscriptions"><label>Find customer by email<input type="search" name="q" defaultValue={q} placeholder="Enter exact email address"/></label><button className="btn secondary">Search</button></form>
 <div className="table-scroll"><table className="admin-table"><thead><tr><th>Customer</th><th>Email</th><th>Charis status</th><th>Last request</th></tr></thead><tbody>
 {contacts.map(c=>{const last=(requests.data||[]).find(r=>r.email===c.email);return <tr key={c.id}>
 <td>{[c.first_name,c.last_name].filter(Boolean).join(' ')||'Customer'}</td><td>{c.email}</td>
 <td>{statusFor(c.email as string,c.unsubscribed_at,c.consent_status)}</td>
 <td>{last?last.verified_at?'Confirmed':last.delivery_state==='accepted'?'Confirmation sent':last.delivery_state.replaceAll('_',' '):'—'}</td></tr>})}
 </tbody></table></div>
 {!contacts.length&&<p className="muted">No matching customers.</p>}
 </section>
 {canInvite&&<section className="panel"><SubscriptionInviteForm/></section>}
 {isAdmin&&<section className="panel"><SubscriptionStaffForm staff={staff} roles={roles.data||[]}/></section>}
 </WorkspaceShell>;
}
