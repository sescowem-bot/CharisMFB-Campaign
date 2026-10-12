'use client';
import {useActionState} from 'react';
import {queueAction} from '@/app/dashboard/delivery/actions';
export function QuickSendForm({org,id,revision}:{org:string;id:string;revision:number}){
 const [result,action,pending]=useActionState(queueAction,{});
 return <form action={action} className="admin-form quick-send-form">
  <h2>Ready to send?</h2><p className="muted">Your approved campaign is ready for delivery. Check the final audience before queuing.</p>
  <input type="hidden" name="organization_id" value={org}/><input type="hidden" name="campaign_id" value={id}/><input type="hidden" name="revision" value={revision}/>
  <label className="quick-send-confirm"><input type="checkbox" required/> I have checked the message, recipient list and permission to contact these customers.</label>
  <button className="btn" name="action" value="enqueue" disabled={pending}>{pending?'Preparing delivery…':'Queue this campaign for sending →'}</button>
  <p className="muted">The delivery worker sends the emails at their scheduled time; this button does not bypass provider limits.</p>
  {result.error&&<p role="alert" className="feedback-error">{result.error}</p>}{result.success&&<p role="status" className="feedback-success">{result.success}</p>}
 </form>;
}
