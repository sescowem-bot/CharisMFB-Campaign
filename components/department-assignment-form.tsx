'use client';
import {useActionState} from 'react';
import {assignDepartment} from '@/app/dashboard/departments/actions';
export function DepartmentAssignmentForm({org,departments,staff}:{org:string;departments:{id:string;name:string}[];staff:{id:string;email:string;role:string}[]}){
 const [state,action,pending]=useActionState(assignDepartment,{});
 return <section className="panel charis-dept-admin"><h2>Assign an existing staff member</h2>
  <p className="muted">Invite staff under Team Access first, then assign their department here. Department membership does not grant extra campaign or administrator permissions.</p>
  <form action={action} className="admin-form"><input type="hidden" name="org" value={org}/>
   <label>Department<select name="department_id" required>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
   <label>Verified staff member<select name="user_id" required>{staff.map(s=><option value={s.id} key={s.id}>{s.email} — {s.role}</option>)}</select></label>
   <label>Department responsibility<select name="department_role"><option value="member">Team member</option><option value="head">Department head</option><option value="observer">Read-only department observer</option></select></label>
   <div className="actions"><button className="btn" disabled={pending||!staff.length||!departments.length}>{pending?'Updating…':'Assign department'}</button><button className="btn secondary" name="remove" value="yes" disabled={pending||!staff.length} formNoValidate>Remove assignment</button></div>
   {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}
  </form>
 </section>;
}
