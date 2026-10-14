'use client';
import {useActionState} from 'react';
import {saveCustomRole,changeRolePermission,changeStaffRole,changeStaffPermission} from '@/app/admin/access/actions';

type Role={id:string;name:string;description:string;active:boolean};
type Capability={permission_key:string;label:string;category:string;description:string};
type Staff={id:string;email:string;base_role:string};
type MemberRole={user_id:string;role_id:string};
type RoleGrant={role_id:string;permission_key:string};
type DirectGrant={user_id:string;permission_key:string;allowed:boolean};
function Result({state}:{state:{error?:string;success?:string}}){return <>{state.error&&<p className="feedback-error" role="alert">{state.error}</p>}{state.success&&<p className="feedback-success" role="status">{state.success}</p>}</>;}
export function RoleCreationForm(){const [state,submit,pending]=useActionState(saveCustomRole,{});
 return <form action={submit} className="admin-form"><label>Role name<input name="name" maxLength={80} required placeholder="e.g. Customer Service Supervisor"/></label><label>Description<input name="description" maxLength={300} placeholder="Optional responsibilities"/></label><button className="btn" disabled={pending}>Create role</button><Result state={state}/></form>;
}
export function RoleGrantForm({roles,permissions,grants}:{roles:Role[];permissions:Capability[];grants:RoleGrant[]}){
 const [state,submit,pending]=useActionState(changeRolePermission,{});
 return <form action={submit} className="admin-form"><label>Custom role<select name="role_id" required>{roles.filter(r=>r.active).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label>Permission<select name="permission_key" required>{permissions.map(p=><option key={p.permission_key} value={p.permission_key}>{p.category} · {p.label}</option>)}</select></label><label>Action<select name="allowed"><option value="yes">Grant permission</option><option value="no">Remove permission</option></select></label><button className="btn secondary" disabled={pending||!roles.some(r=>r.active)}>Update role</button><Result state={state}/><p className="muted">Existing role capabilities: {grants.length}. Select a role and a permission to change it.</p></form>;
}
export function StaffRoleForm({staff,roles,assigned}:{staff:Staff[];roles:Role[];assigned:MemberRole[]}){
 const [state,submit,pending]=useActionState(changeStaffRole,{});
 return <form action={submit} className="admin-form"><label>Staff member<select name="user_id" required>{staff.map(s=><option key={s.id} value={s.id}>{s.email} · {s.base_role}</option>)}</select></label><label>Custom role<select name="role_id" required>{roles.filter(r=>r.active).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label>Action<select name="assign"><option value="yes">Assign role</option><option value="no">Remove role</option></select></label><button className="btn secondary" disabled={pending||!staff.length||!roles.some(r=>r.active)}>Save assignment</button><Result state={state}/><p className="muted">{assigned.length} current custom role assignments.</p></form>;
}
export function IndividualPermissionForm({staff,permissions,grants}:{staff:Staff[];permissions:Capability[];grants:DirectGrant[]}){
 const [state,submit,pending]=useActionState(changeStaffPermission,{});
 return <form action={submit} className="admin-form"><label>Staff member<select name="user_id" required>{staff.map(s=><option key={s.id} value={s.id}>{s.email} · {s.base_role}</option>)}</select></label><label>Permission<select name="permission_key" required>{permissions.map(p=><option key={p.permission_key} value={p.permission_key}>{p.category} · {p.label}</option>)}</select></label><label>Override<select name="allowed"><option value="yes">Allow</option><option value="no">Deny</option></select></label><button className="btn secondary" disabled={pending||!staff.length}>Update staff access</button><Result state={state}/><p className="muted">{grants.length} individual permissions configured. Explicit overrides take priority over custom and primary roles.</p></form>;
}
