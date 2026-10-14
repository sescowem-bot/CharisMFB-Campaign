'use client';
import {useActionState,useState} from 'react';
import {smsAction} from '@/app/dashboard/sms/actions';
type Group={id:string;name:string};
type Campaign={id:string;title:string;message:string;purpose:string;audience_type:string;audience_id:string|null;status:string;edited_by:string;submitted_by:string|null;review_note:string};
export function SmsComposer({org,groups}:{org:string;groups:Group[]}){
 const [state,action,pending]=useActionState(smsAction,{});
 const [message,setMessage]=useState('');const [audience,setAudience]=useState<'all'|'list'>(groups.length?'list':'all');
 return <section className="panel"><h2>Create an SMS draft</h2><p className="muted">Prepare a message for review. Saving does not send SMS or charge the bank.</p>
  <form action={action} className="admin-form charis-sms-compose"><input type="hidden" name="org" value={org}/><input type="hidden" name="action" value="save"/>
   <label>Campaign name<input name="title" minLength={2} maxLength={120} placeholder="October customer account update" required/></label>
   <label>Message purpose<select name="purpose" defaultValue="service_notice"><option value="service_notice">Account or service notice (requires bank approval)</option><option value="marketing">Promotional message (requires SMS consent)</option></select></label>
   <label>SMS message<textarea name="message" rows={5} maxLength={480} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Charis Microfinance Bank: Important information about our banking services..." required/></label>
   <p className="muted">{message.length}/480 characters. Messages longer than a standard SMS may cost multiple SMS units. Never include a PIN, password, OTP, BVN or full account number in a campaign.</p>
   <label>Customer audience<select name="audience_type" value={audience} onChange={e=>setAudience(e.target.value as 'all'|'list')}><option value="list">Choose saved group</option><option value="all">All eligible customers (when enabled)</option></select></label>
   {audience==='list'&&<label>Saved group<select name="audience_id" required defaultValue=""><option value="">Select a group</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>}
   <p className="muted">No customer texts are sent in this pilot. Real sending will require SMS-specific opt-outs, validated recipient eligibility, a sender ID and a bank-approved delivery budget.</p>
   <button className="btn" type="submit" disabled={pending}>{pending?'Saving…':'Save SMS draft'}</button>
   {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}
  </form></section>;
}
export function SmsCampaignActions({org,campaign,canEdit,canApprove,userId,canTest}:{org:string;campaign:Campaign;canEdit:boolean;canApprove:boolean;userId:string;canTest:boolean}){
 const [result,action,pending]=useActionState(smsAction,{});
 const selfReview=campaign.edited_by===userId||campaign.submitted_by===userId;
 const options:string[]=[];
 if(canEdit&&['draft','rejected'].includes(campaign.status))options.push('submit');
 if(canEdit&&campaign.status==='pending_approval')options.push('withdraw');
 if(canApprove&&campaign.status==='pending_approval'&&!selfReview)options.push('approve','reject');
 if(canEdit&&canTest)options.push('test');
 if(!options.length)return <p className="muted">{campaign.status==='pending_approval'&&selfReview?'Another authorised staff member must review this campaign.':'No actions available for this campaign.'}</p>;
 return <form action={action} className="charis-sms-actions"><input type="hidden" name="org" value={org}/><input type="hidden" name="id" value={campaign.id}/><div className="charis-sms-action-row">
 {options.map(opt=><button key={opt} className={`btn ${opt==='approve'||opt==='submit'?'':'secondary'}`} name="action" value={opt} disabled={pending} type="submit">{opt==='test'?'Send staff test':opt==='submit'?'Submit for approval':opt==='approve'?'Approve':opt==='reject'?'Reject':'Withdraw'}</button>)}
 </div><p className="muted">Staff test messages go only to the approved number configured by the administrator. Approval does not send to customers.</p>
 {result.error&&<p role="alert" className="feedback-error">{result.error}</p>}{result.success&&<p role="status" className="feedback-success">{result.success}</p>}</form>;
}
