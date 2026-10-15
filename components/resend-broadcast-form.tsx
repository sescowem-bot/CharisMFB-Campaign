'use client';
import {useActionState} from 'react';
import {sendApprovedResendBroadcast} from '@/app/dashboard/campaigns/resend-action';
export function ResendBroadcastForm({org,id,revision,ready}:{org:string;id:string;revision:number;ready:boolean}){
 const [state,action,pending]=useActionState(sendApprovedResendBroadcast,{});
 return <form action={action} className="panel admin-form">
  <h2>Send approved campaign</h2>
  <p className="muted">Charis submits approved promotional email through Resend Broadcasts. Only customers with recorded marketing permission qualify. Unsubscribed contacts are excluded.</p>
  <input type="hidden" name="organization_id" value={org}/><input type="hidden" name="campaign_id" value={id}/><input type="hidden" name="revision" value={revision}/>
  <label><input type="checkbox" required name="confirmed" value="yes"/> I have reviewed this approved message, audience, and recorded customer marketing permissions.</label>
  <button className="btn" disabled={!ready||pending}>{pending?'Preparing provider submission…':'Send approved campaign with Resend'}</button>
  {!ready&&<p role="alert" className="notice">Resend marketing is not yet activated by the bank administrator. Enable Resend Broadcasts only after completing the sender and policy setup.</p>}
  {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}
  {state.success&&<p role="status" className="feedback-success">{state.success}</p>}
  <p className="muted">Submitted is not delivered. This rollout supports up to 50 unique recipients per approved campaign. Failed or uncertain submissions must be reconciled, never retried blindly.</p>
 </form>;
}
