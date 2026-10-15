'use client';
import {useActionState,useState} from 'react';
import {saveCustomRole,changeRolePermission,saveStaffCustomRoles,changeStaffPermission} from '@/app/admin/access/actions';

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
 const active=roles.filter(r=>r.active);
 return <form action={submit} className="admin-form">
  <label>Custom role
   <select name="role_id" required disabled={!active.length} defaultValue="">
    <option value="" disabled>{active.length?'Choose a custom role':'No custom roles created yet'}</option>
    {active.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
   </select>
  </label>
  {!active.length&&<p className="muted" role="status">First create a custom role using the form above. Then assign its permissions here.</p>}
  <label>Permission<select name="permission_key" required>{permissions.map(p=><option key={p.permission_key} value={p.permission_key}>{p.category} · {p.label}</option>)}</select></label>
  <label>Action<select name="allowed"><option value="yes">Grant permission</option><option value="no">Remove permission</option></select></label>
  <button className="btn secondary" disabled={pending||!active.length}>Update role</button><Result state={state}/>
  <p className="muted">Existing role capabilities: {grants.length}. These are custom role permissions; primary staff roles are managed in Team Access.</p>
 </form>;
}
function CustomRoleSelection({userId,roles,assigned}:{userId:string;roles:Role[];assigned:MemberRole[]}){
 const [state,submit,pending]=useActionState(saveStaffCustomRoles,{});
 const active=roles.filter(r=>r.active);
 const initial=assigned.filter(a=>a.user_id===userId).map(a=>a.role_id);
 const [chosen,setChosen]=useState<string[]>(()=>initial.filter(id=>active.some(r=>r.id===id)));
 const assignedNames=assigned.filter(a=>a.user_id===userId).map(a=>roles.find(r=>r.id===a.role_id)?.name||'Unknown role');
 return <form action={submit} className="admin-form">
  <input type="hidden" name="user_id" value={userId}/>
  <p className="muted">Select all custom roles this staff member should keep. Unticking a role removes that assignment when you save.</p>
  {active.length?<fieldset className="charis-role-checklist">
   <legend>Custom roles (select multiple)</legend>
   {active.map(r=><label key={r.id} className="charis-role-check-item">
    <input type="checkbox" name="role_id" value={r.id} checked={chosen.includes(r.id)} onChange={e=>setChosen(current=>e.target.checked?[...current,r.id]:current.filter(id=>id!==r.id))}/>
    <span><strong>{r.name}</strong>{r.description&&<span className="muted"> — {r.description}</span>}</span>
   </label>)}
  </fieldset>:<p className="muted" role="status">There are no active custom roles. Create one above, then return here to assign it.</p>}
  <p className="muted">Current custom roles: {assignedNames.length?assignedNames.join(', '):'None'}. Built-in responsibilities are managed separately in Team Access.</p>
  <button className="btn secondary" disabled={pending||(!active.length&&!assignedNames.length)}>
   {pending?'Saving…':'Save selected roles'}
  </button>
  <Result state={state}/>
 </form>;
}
export function StaffRoleForm({staff,roles,assigned}:{staff:Staff[];roles:Role[];assigned:MemberRole[]}){
 const [selected,setSelected]=useState(staff[0]?.id||'');
 return <section className="admin-form">
  <label>Staff member
   <select value={selected} onChange={e=>setSelected(e.target.value)} disabled={!staff.length}>
    {staff.map(s=><option key={s.id} value={s.id}>{s.email} · {s.base_role}</option>)}
   </select>
  </label>
  {selected&&<CustomRoleSelection key={selected} userId={selected} roles={roles} assigned={assigned}/>}
  {!staff.length&&<p className="muted" role="status">No verified staff members were found. Invite staff from Team Access first.</p>}
  <p className="muted">{assigned.length} existing custom role assignments. To give a colleague multiple built-in roles such as Campaign Lead and Approver, open Team Access → Manage → Additional responsibilities.</p>
 </section>;
}
export function IndividualPermissionForm({staff,permissions,grants}:{staff:Staff[];permissions:Capability[];grants:DirectGrant[]}){
 const [state,submit,pending]=useActionState(changeStaffPermission,{});
 return <form action={submit} className="admin-form"><label>Staff member<select name="user_id" required>{staff.map(s=><option key={s.id} value={s.id}>{s.email} · {s.base_role}</option>)}</select></label><label>Permission<select name="permission_key" required>{permissions.map(p=><option key={p.permission_key} value={p.permission_key}>{p.category} · {p.label}</option>)}</select></label><label>Override<select name="allowed"><option value="yes">Allow</option><option value="no">Deny</option></select></label><button className="btn secondary" disabled={pending||!staff.length}>Update staff access</button><Result state={state}/><p className="muted">{grants.length} individual permissions configured. Explicit overrides take priority over custom and primary roles.</p></form>;
}
