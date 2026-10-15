'use client';
import {useActionState,useState} from 'react';
import {assignDepartment} from '@/app/dashboard/departments/actions';
export function DepartmentAssignmentForm({org,departments,staff,members}:{org:string;departments:{id:string;name:string}[];staff:{id:string;email:string;role:string}[];members:{department_id:string;user_id:string;department_role:string}[]}){
 const [state,action,pending]=useActionState(assignDepartment,{});
 const [selectedDepartment,setSelectedDepartment]=useState(departments[0]?.id||'');
 const [selectedStaff,setSelectedStaff]=useState(staff[0]?.id||'');
 const existing=members.find(m=>m.department_id===selectedDepartment&&m.user_id===selectedStaff);
 const [role,setRole]=useState(()=>members.find(m=>m.department_id===departments[0]?.id&&m.user_id===staff[0]?.id)?.department_role||'member');
 const chooseDepartment=(id:string)=>{setSelectedDepartment(id);setRole(members.find(m=>m.department_id===id&&m.user_id===selectedStaff)?.department_role||'member');};
 const chooseStaff=(id:string)=>{setSelectedStaff(id);setRole(members.find(m=>m.department_id===selectedDepartment&&m.user_id===id)?.department_role||'member');};
 return <section className="panel charis-dept-admin"><h2>Assign staff to a department</h2>
  <p className="muted">Choose a department and a verified staff member. You can also manage this assignment together with roles and module actions under Administration → People & permissions.</p>
  <form action={action} className="admin-form"><input type="hidden" name="org" value={org}/>
   <label>Department<select name="department_id" required value={selectedDepartment} onChange={e=>chooseDepartment(e.target.value)}>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
   <label>Verified staff member<select name="user_id" required value={selectedStaff} onChange={e=>chooseStaff(e.target.value)}>{staff.map(s=><option value={s.id} key={s.id}>{s.email} — {s.role}</option>)}</select></label>
   <label>Department responsibility<select name="department_role" value={role} onChange={e=>setRole(e.target.value)}><option value="member">Team member</option><option value="head">Department head</option><option value="observer">Read-only department observer</option></select></label>
   <p className="muted" role="status">{existing?`Current membership: ${existing.department_role}`:'This staff member is not assigned to the selected department.'}</p>
   <div className="actions"><button className="btn" disabled={pending||!staff.length||!departments.length}>{pending?'Updating…':'Assign department'}</button><button className="btn secondary" name="remove" value="yes" disabled={pending||!staff.length||!departments.length||!existing} formNoValidate>Remove assignment</button></div>
   {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}
  </form>
 </section>;
}
