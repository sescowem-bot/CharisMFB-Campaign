'use client';
import {useActionState,useState} from 'react';
import {createReminder,changeReminderStatus} from '@/app/dashboard/reminders/actions';
export function ReminderCreator({org,departments,staff,currentUser}:{org:string;departments:{id:string;name:string}[];staff:{department_id:string;user_id:string;label:string}[];currentUser:string}){
 const [state,action,pending]=useActionState(createReminder,{});
 const [department,setDepartment]=useState(departments[0]?.id||'');
 const [date,setDate]=useState('');
 const current=staff.filter(s=>s.department_id===department);
 return <section className="panel"><h2>New internal reminder</h2><p className="muted">For staff follow-ups, reviews and scheduled tasks. Reminders never send an email or SMS to bank customers automatically.</p>
  <form action={action} className="admin-form"><input name="org" type="hidden" value={org}/><input type="hidden" name="due_at" value={date&&!Number.isNaN(Date.parse(date))?new Date(date).toISOString():''}/>
   <label>Department<select required name="department_id" value={department} onChange={e=>setDepartment(e.target.value)}>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
   <label>What needs to be done?<input required name="title" maxLength={160} placeholder="Review the October service announcement"/></label>
   <label>Details (optional)<textarea name="notes" maxLength={1500} rows={3} placeholder="Include instructions, not confidential customer account details"/></label>
   <div className="form-two"><label>Due date and time (your local time)<input type="datetime-local" required value={date} onChange={e=>setDate(e.target.value)}/></label>
    <label>Priority<select name="priority"><option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option></select></label></div>
   <label>Assign to<select name="assigned_to" required defaultValue={current.find(s=>s.user_id===currentUser)?.user_id||current[0]?.user_id||''} key={department}>{current.map(s=><option key={s.user_id} value={s.user_id}>{s.label}</option>)}</select></label>
   <button className="btn" disabled={pending||!current.length||!date}>{pending?'Saving…':'Create reminder'}</button>
   {state.error&&<p className="feedback-error" role="alert">{state.error}</p>}{state.success&&<p className="feedback-success" role="status">{state.success}</p>}
  </form></section>;
}
export function ReminderStatusForm({org,id,status}:{org:string;id:string;status:string}){
 const [state,action,pending]=useActionState(changeReminderStatus,{});
 return <form className="charis-inline-reminder" action={action}><input type="hidden" name="org" value={org}/><input type="hidden" name="id" value={id}/>
  {status!=='done'&&<button className="btn secondary" name="status" value="done" disabled={pending}>Mark done</button>}
  {status!=='open'&&<button className="btn secondary" name="status" value="open" disabled={pending}>Reopen</button>}
  {status==='open'&&<button className="btn secondary" name="status" value="cancelled" disabled={pending}>Cancel</button>}
  {state.error&&<small role="alert" className="feedback-error">{state.error}</small>}{state.success&&<small role="status">{state.success}</small>}
 </form>;
}
