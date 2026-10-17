'use client';
import {useActionState} from 'react';
import {subscriptionAdminAction} from '@/app/admin/subscriptions/actions';
export function SubscriptionInviteForm(){
 const [result,action,pending]=useActionState(subscriptionAdminAction,{});
 return <form action={action} className="admin-form"><input type="hidden" name="mode" value="invite"/>
 <h2>Send subscription confirmation</h2>
 <label>Customer email<input name="email" type="email" maxLength={254} required placeholder="customer@example.com"/></label>
 <label><input type="checkbox" name="customer_requested" required/> Customer asked to subscribe again</label>
 <button className="btn" disabled={pending}>{pending?'Sending…':'Send confirmation link'}</button>
 {result.error&&<p className="feedback-error" role="alert">{result.error}</p>}{result.success&&<p role="status" className="feedback-success">{result.success}</p>}
 <p className="muted">The customer must confirm using their email. Staff cannot restore consent on their behalf.</p></form>;
}
export function SubscriptionStaffForm({staff,roles}:{staff:{id:string;email:string}[];roles:{user_id:string;can_view:boolean;can_invite:boolean}[]}){
 const [result,action,pending]=useActionState(subscriptionAdminAction,{});
 return <form action={action} className="admin-form"><input type="hidden" name="mode" value="delegate"/>
 <h2>Subscription management access</h2>
 <label>Staff member<select name="user" required defaultValue=""><option value="">Select staff</option>{staff.map(s=><option key={s.id} value={s.id}>{s.email}</option>)}</select></label>
 <label><input type="checkbox" name="view"/> View customer subscription statuses</label>
 <label><input type="checkbox" name="invite"/> Send customer resubscription invitations</label>
 <button className="btn secondary" disabled={pending}>Save staff role</button>
 <p className="muted">Existing assignments: {roles.filter(r=>r.can_view||r.can_invite).length} staff. An invitation cannot silently resubscribe anyone.</p>
 {result.error&&<p role="alert" className="feedback-error">{result.error}</p>}{result.success&&<p role="status" className="feedback-success">{result.success}</p>}</form>;
}
