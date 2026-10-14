'use client';
import {useActionState} from 'react';
import {saveDepartment} from '@/app/dashboard/departments/actions';
export function CreateDepartmentForm(){
 const [state,action,pending]=useActionState(saveDepartment,{});
 return <section className="panel"><h2>Create department</h2><p className="muted">Add only the departments your bank needs. Department names and responsibilities are managed here.</p><form className="admin-form" action={action}><label>Department name<input name="name" required minLength={3} maxLength={100} placeholder="Enter department name"/></label><label>Description<textarea name="description" maxLength={500} placeholder="What this team is responsible for"/></label><button disabled={pending} className="btn">Create department</button>{state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}</form></section>;
}
export function EditDepartmentForm({department}:{department:{id:string;name:string;description:string;active:boolean}}){
 const [state,action,pending]=useActionState(saveDepartment,{});
 return <form className="admin-form" action={action}><input type="hidden" name="department_id" value={department.id}/><label>Department name<input name="name" maxLength={100} required defaultValue={department.name}/></label><label>Description<textarea name="description" maxLength={500} defaultValue={department.description}/></label><label>Status<select name="active" defaultValue={department.active?'yes':'no'}><option value="yes">Active</option><option value="no">Archived</option></select></label><button disabled={pending} className="btn secondary">Save department</button>{state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}</form>;
}
