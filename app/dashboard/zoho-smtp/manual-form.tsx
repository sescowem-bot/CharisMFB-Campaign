'use client';
import {useActionState,useState} from 'react';
import {MailCheck,Send,ShieldCheck} from 'lucide-react';
import {sendMyZohoSelfTest,sendManualZohoLetter} from './manual-actions';

export function ZohoSelfTestForm({enabled}:{enabled:boolean}){
 const [state,action,pending]=useActionState(sendMyZohoSelfTest,{});
 return <form action={action} className="admin-form">
  <h3>Step 2 — Send one test email to myself</h3>
  <p className="muted">After SMTP verification succeeds, this sends one real message to your own Zoho address. It does not email any customer.</p>
  <button type="submit" className="btn secondary" disabled={!enabled||pending||!!state.success||!!state.uncertain}>
   <MailCheck size={16}/> {pending?'Sending the test…':'Send test email to my inbox'}
  </button>
  {state.success&&<p role="status" className="feedback-success">{state.success}</p>}
  {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}
 </form>;
}

export function ZohoManualForm({sender,nonce,ready,enabled}:{sender:string;nonce:string;ready:boolean;enabled:boolean}){
 const [state,action,pending]=useActionState(sendManualZohoLetter,{});
 const [to,setTo]=useState('');
 const [subject,setSubject]=useState('');
 const [body,setBody]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const canSend=ready&&enabled&&!pending&&!state.success&&!state.uncertain&&confirmed&&
  /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to.trim())&&subject.trim().length>=3&&body.trim().length>=10;
 return <form action={action} className="admin-form charis-zoho-letter-form">
  <input type="hidden" name="nonce" value={nonce}/>
  <input type="hidden" name="confirmed" value={confirmed?'yes':'no'}/>
  <div className="workspace-heading"><div><h2>Step 3 — Write to one client</h2>
   <p className="muted">One recipient per email. You write, review and click Send yourself. No automatic follow-ups or mailing lists.</p></div>
   <Send size={22}/></div>
  <label>From <input value={sender} readOnly aria-label="Your Zoho sender address"/></label>
  <label>Client email address <input type="email" name="to" autoComplete="off" required maxLength={254} value={to} placeholder="client@example.com" onChange={e=>{setTo(e.target.value);setConfirmed(false);}}/></label>
  <label>Subject <input name="subject" required maxLength={160} minLength={3} value={subject} placeholder="Your Charis banking enquiry" onChange={e=>{setSubject(e.target.value);setConfirmed(false);}}/></label>
  <label>Message <textarea name="body" required rows={7} maxLength={4000} minLength={10} value={body} placeholder="Dear Customer, thank you for contacting Charis Microfinance Bank..." onChange={e=>{setBody(e.target.value);setConfirmed(false);}}/></label>
  <section aria-label="Email preview" className="charis-zoho-letter-preview">
   <strong>Preview your email</strong>
   <dl><div><dt>From</dt><dd>{sender}</dd></div><div><dt>To</dt><dd>{to||'Choose a recipient'}</dd></div>
   <div><dt>Subject</dt><dd>{subject||'Enter a subject'}</dd></div></dl>
   <div className="charis-zoho-letter-preview-body"><strong>Charis Microfinance Bank</strong><p>{body||'Your message will appear here.'}</p></div>
  </section>
  <label className="charis-zoho-manual-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
   I checked the client email address and message, and I authorise this one email to be sent.</label>
  <button className="btn" type="submit" disabled={!canSend}>
   <ShieldCheck size={16}/>{pending?'Submitting this email…':'Confirm & send this email'}
  </button>
  {!ready&&<p className="muted">The personal Zoho SMTP account must be configured and match your bank login before sending.</p>}
  {ready&&!enabled&&<p className="muted">An administrator must enable manual client correspondence after SQL 077 has been applied and your SMTP test succeeds.</p>}
  {state.success&&<p role="status" className="feedback-success">{state.success} <a href="/dashboard/zoho-smtp">Write another message</a></p>}
  {state.error&&<p role="alert" className="feedback-error">{state.error} {state.uncertain&&<a href="/dashboard/zoho-smtp">Return to mailbox page</a>}</p>}
  <p className="muted">Normal individual business correspondence only. For bulk or automated notifications, use the dedicated Campaign Centre email providers.</p>
 </form>;
}
