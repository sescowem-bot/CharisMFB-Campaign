'use client';
import {useActionState} from 'react';
import {subscriptionAdminAction} from '@/app/admin/subscriptions/actions';
export function SubscriptionStaffForm({staff,roles}:{staff:{id:string;email:string}[];roles:{user_id:string;can_view:boolean}[]}){
 const [result,action,pending]=useActionState(subscriptionAdminAction,{});
 return <form action={action} className="admin-form"><input type="hidden" name="mode" value="delegate"/>
  <h2>Email preference access</h2>
  <label>Staff member<select name="user" required defaultValue=""><option value="">Select staff</option>{staff.map(s=><option key={s.id} value={s.id}>{s.email}</option>)}</select></label>
  <label><input type="checkbox" name="view"/> Allow staff to view customer email preferences</label>
  <button className="btn secondary" disabled={pending}>Save staff access</button>
  <p className="muted">Staff with access can review opt-outs. Customers unsubscribe through the link in their email.</p>
  <p className="muted">Currently assigned: {roles.filter(r=>r.can_view).length} staff.</p>
  {result.error&&<p role="alert" className="feedback-error">{result.error}</p>}{result.success&&<p role="status" className="feedback-success">{result.success}</p>}
 </form>;
}
