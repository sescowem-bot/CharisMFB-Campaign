'use client';
import {useActionState,useEffect,useMemo,useState} from 'react';
import {createCreditFollowup,changeCreditFollowup} from '@/app/dashboard/credit-followups/actions';
import {readStaffNotification} from '@/app/dashboard/notifications/actions';
type Loan={id:string;reference:string;customer:string;due_on:string};
type Staff={id:string;label:string};
export function FollowupCreateForm({loans,staff,self,canAssign,initialKey}:{loans:Loan[];staff:Staff[];self:string;canAssign:boolean;initialKey:string}){
 const [result,action,pending]=useActionState(createCreditFollowup,{});
 const [key,setKey]=useState(initialKey);
 useEffect(()=>{if(!pending&&result.success)setKey(crypto.randomUUID());},[pending,result.success]);
 const [date,setDate]=useState('');
 const due=useMemo(()=>date&&Number.isFinite(new Date(date).getTime())?new Date(date).toISOString():'',[date]);
 return <form action={action} className="admin-form">
  <h2>Schedule a loan follow-up</h2>
  <p className="muted">Internal task only. Confirm the core banking balance before discussing a repayment with a customer.</p>
  <input type="hidden" name="key" value={key}/><input type="hidden" name="due" value={due}/>
  <label>Loan<select name="loan" required>{loans.map(l=><option key={l.id} value={l.id}>{l.reference} · {l.customer} · due {l.due_on}</option>)}</select></label>
  <label>Assign to<select name="assigned" defaultValue={self} required>{canAssign?staff.map(s=><option value={s.id} key={s.id}>{s.label}</option>):<option value={self}>Me</option>}</select></label>
  <div className="form-two"><label>Follow-up date and time (your local timezone)<input type="datetime-local" value={date} onChange={e=>setDate(e.target.value)} required/></label><label>Priority<select name="priority"><option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option></select></label></div>
  <label>Private internal notes<textarea name="notes" rows={3} maxLength={1200} placeholder="Next action for the assigned Credit Officer. Do not enter BVN, PIN or passwords."/></label>
  <button className="btn" disabled={pending||!loans.length||!due}>{pending?'Saving…':'Create follow-up'}</button>
  {result.error&&<p role="alert" className="feedback-error">{result.error}</p>}{result.success&&<p role="status" className="notice">{result.success}</p>}
 </form>;
}
export function FollowupStatusForm({id,status}:{id:string;status:string}){
 const [result,action,pending]=useActionState(changeCreditFollowup,{});
 return <form action={action} className="actions"><input type="hidden" name="id" value={id}/>
  <select name="status" defaultValue={status} aria-label="Follow-up status"><option value="open">To do</option><option value="done">Completed</option><option value="cancelled">Cancelled</option></select>
  <button className="btn secondary" disabled={pending}>Update</button>
  {result.error&&<span role="alert" className="feedback-error">{result.error}</span>}{result.success&&<span role="status">{result.success}</span>}
 </form>;
}
export function NotificationReadForm({id}:{id:string}){
 const [result,action,pending]=useActionState(readStaffNotification,{});
 return <form action={action} className="actions"><input type="hidden" name="id" value={id}/><button className="btn secondary" disabled={pending}>{pending?'Saving…':'Mark as read'}</button>
 {result.error&&<span role="alert" className="feedback-error">{result.error}</span>}{result.success&&<span role="status">{result.success}</span>}
 </form>;
}
