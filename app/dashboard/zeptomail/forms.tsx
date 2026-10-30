'use client';
import {useActionState,useState} from 'react';
import {CheckCircle2,ShieldCheck,PlugZap} from 'lucide-react';
import {verifyZepto,testZeptoToSelf,sendZeptoNotice} from './actions';
import {zeptoPurposes} from '@/lib/email/zeptomail-options';
function Feedback({state}:{state:{message?:string;error?:string;uncertain?:boolean}}){
 return <>{state.message&&<p className="feedback-success" role="status"><CheckCircle2 size={15}/> {state.message}</p>}
 {state.error&&<p className="feedback-error" role="alert">{state.error}</p>}</>;
}
export function ZeptoChecks({ready,testEnabled,testEmail}:{ready:boolean;testEnabled:boolean;testEmail:string}){
 const [verify,verifyAction,verifying]=useActionState(verifyZepto,{});
 const [send,sendAction,sending]=useActionState(testZeptoToSelf,{});
 const canTest=ready&&testEnabled;
 return <div className="charis-zepto-test-grid">
  <form className="admin-form" action={verifyAction}><h3>1. Verify connection</h3>
   <p className="muted">Authenticate to the bank Mail Agent without sending a message.</p>
   <button className="btn secondary" disabled={!canTest||verifying}><PlugZap size={16}/>{verifying?'Checking…':'Verify ZeptoMail SMTP'}</button>
   <Feedback state={verify}/></form>
  <form className="admin-form" action={sendAction}><h3>2. Send a test to myself</h3>
   <p className="muted">One real email to your verified signed-in address: <strong>{testEmail}</strong>. No customer messages.</p>
   <button className="btn secondary" disabled={!canTest||sending||Boolean(send.message)||Boolean(send.uncertain)}>
    {sending?'Submitting test…':'Send one test to my inbox'}</button>
   <Feedback state={send}/></form>
 </div>;
}
export function ZeptoNoticeComposer({sender,nonce,ready,enabled}:{sender:string;nonce:string;ready:boolean;enabled:boolean}){
 const [state,action,pending]=useActionState(sendZeptoNotice,{});
 const [to,setTo]=useState(''),[subject,setSubject]=useState(''),[body,setBody]=useState(''),
  [purpose,setPurpose]=useState('account_notice'),[reference,setReference]=useState(''),[confirmed,setConfirmed]=useState(false);
 const update=(set:(x:string)=>void)=>(s:string)=>{set(s);setConfirmed(false);};
 const canSend=ready&&enabled&&!pending&&!state.message&&!state.uncertain&&confirmed
  &&/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)&&subject.trim().length>=5&&body.trim().length>=20&&reference.trim().length>=4;
 return <form action={action} className="admin-form charis-zepto-form">
  <input name="nonce" type="hidden" value={nonce}/>
  <input name="confirmed" type="hidden" value={confirmed?'yes':'no'}/>
  <h2>3. Send one customer-specific notification</h2>
  <p className="muted">Only send for an actual account event, existing repayment, receipt or customer request. No promotional or general awareness campaigns.</p>
  <label>Send from <input readOnly value={sender||'Mail Agent not configured'} /></label>
  <label>Notification type<select name="purpose" value={purpose} onChange={e=>update(setPurpose)(e.target.value)}>
   {zeptoPurposes.map(p=><option value={p.value} key={p.value}>{p.label}</option>)}</select></label>
  <label>Related transaction or customer-request reference<input name="reference" maxLength={120} required placeholder="Loan, receipt or support reference" value={reference} onChange={e=>update(setReference)(e.target.value)}/></label>
  <label>Client email<input name="to" type="email" required value={to} onChange={e=>update(setTo)(e.target.value)} placeholder="customer@example.com"/></label>
  <label>Subject<input name="subject" required maxLength={160} value={subject} onChange={e=>update(setSubject)(e.target.value)} placeholder="Update about your recent request"/></label>
  <label>Message<textarea name="body" required rows={7} maxLength={4000} value={body} onChange={e=>update(setBody)(e.target.value)} placeholder="Dear Customer, here is the update related to your account or request."/></label>
  <div className="charis-zepto-preview" aria-label="ZeptoMail message preview" role="region">
   <strong>Check your message</strong>
   <dl><div><dt>From</dt><dd>{sender||'Sender not set'}</dd></div><div><dt>To</dt><dd>{to||'Recipient not entered'}</dd></div>
   <div><dt>Subject</dt><dd>{subject||'Subject not entered'}</dd></div></dl>
   <div className="charis-zepto-preview-body"><strong>Charis Microfinance Bank</strong><p>{body||'Your notification appears here.'}</p></div>
  </div>
  <label className="charis-zepto-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
   I confirm this is a genuine, customer-specific banking notification, and I reviewed the recipient and content.</label>
  <button className="btn" disabled={!canSend}><ShieldCheck size={16}/>{pending?'Submitting…':'Confirm & send notification'}</button>
  {!ready&&<p className="muted">Configure ZeptoMail SMTP settings and verify the Mail Agent before sending.</p>}
  {ready&&!enabled&&<p className="muted">A bank administrator must complete SQL 079 and enable transactional sending after the test succeeds.</p>}
  <Feedback state={state}/>
  {state.id&&<p className="muted">Reference: {state.id}. Check the ZeptoMail Mail Agent for final delivery status; do not blindly resend.</p>}
 </form>;
}
