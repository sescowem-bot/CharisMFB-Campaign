 'use client';
import {useActionState} from 'react';
import {directAdminAction} from '@/app/admin/communications/actions';
export function DirectSettingsForm({settings}:{settings:{approval_required:boolean;email_enabled:boolean;sms_enabled:boolean;max_recipients:number}}){
 const [state,action,pending]=useActionState(directAdminAction,{});
 return <form action={action} className="admin-form"><input name="action" type="hidden" value="settings"/><h2>Simple sending policy</h2>
 <label><input type="checkbox" name="approval" defaultChecked={settings.approval_required}/> Require approval before sending (off by default)</label>
 <label><input type="checkbox" name="email" defaultChecked={settings.email_enabled}/> Allow email communications</label>
 <label><input type="checkbox" name="sms" defaultChecked={settings.sms_enabled}/> Allow SMS communications (also requires live Termii configuration)</label>
 <label>Maximum recipients per message<input name="max_recipients" type="number" min={1} max={50} defaultValue={settings.max_recipients}/></label>
 <button className="btn" disabled={pending}>Save communication policy</button>
 {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}
 </form>;
}
export function DirectProviderForm({provider,senders,current}:{provider:'resend'|'brevo'|'mailjet';senders:{id:string;name:string;email:string}[];current?:{sender_id:string;enabled:boolean;priority:number}}){
 const [state,action,pending]=useActionState(directAdminAction,{});
 return <form className="admin-form" action={action}><input name="action" type="hidden" value="provider"/><input name="provider" type="hidden" value={provider}/>
 <h3>{provider==='resend'?'Resend':provider==='brevo'?'Brevo':'Mailjet'}</h3>
 <label>Verified service sender<select name="sender" required defaultValue={current?.sender_id||''}><option value="">Choose verified sender</option>{senders.map(s=><option key={s.id} value={s.id}>{s.name} — {s.email}</option>)}</select></label>
 <label>Priority (lower number first)<input name="priority" type="number" defaultValue={current?.priority??10} min={1} max={100}/></label>
 <label><input name="enabled" type="checkbox" defaultChecked={current?.enabled===true}/> Use for official bank service emails</label>
 <button className="btn secondary" disabled={pending||!senders.length}>Save sender preference</button>
 {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}
 </form>;
}
export function DirectStaffForm({staff,rules}:{staff:{id:string;email:string}[];rules:{user_id:string;can_send:boolean}[]}){
 const [state,action,pending]=useActionState(directAdminAction,{});
 return <form className="admin-form" action={action}><input name="action" type="hidden" value="staff"/><h2>Staff sending access</h2>
 <p className="muted">Active staff may send by default within their authorised customer scope. Use this only to restrict individual staff.</p>
 <label>Staff member<select name="user" required defaultValue=""><option value="">Choose staff</option>{staff.map(s=><option key={s.id} value={s.id}>{s.email}</option>)}</select></label>
 <label>Access<select name="can_send" defaultValue="yes"><option value="yes">Allow sending</option><option value="no">Restrict sending</option></select></label>
 <button className="btn secondary" disabled={pending}>Save staff access</button>
 {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}
 <p className="muted">Currently restricted: {rules.filter(r=>!r.can_send).length} staff. A separate explicit denial in the role/permission system also takes effect.</p>
 </form>;
}
