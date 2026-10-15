'use client';
import {useActionState,useMemo,useState} from 'react';
import {saveStaffAccessMatrix,saveRoleCapabilityMatrix} from '@/app/admin/access/actions';

export type AccessRole={id:string;name:string;description:string;active:boolean};
export type AccessCapability={permission_key:string;label:string;category:string;description:string};
export type AccessStaff={id:string;email:string;base_role:string};
export type AssignedRole={user_id:string;role_id:string};
export type ExtraRole={user_id:string;role:string};
export type CapabilityGrant={role_id:string;permission_key:string};
export type DirectCapability={user_id:string;permission_key:string;allowed:boolean};
export type AccessDepartment={id:string;name:string;description:string};
export type StaffDepartment={department_id:string;user_id:string;department_role:string};
const baseRoles=[
 ['viewer','Read only'],['analyst','Analyst'],['designer','Designer'],['approver','Campaign reviewer'],
 ['campaign_lead','Campaign lead'],['manager','Manager'],['company_admin','Bank administrator']
] as const;
const additionalRoles=baseRoles.filter(([k])=>k!=='company_admin');
function InlineResult({state}:{state:{error?:string;success?:string}}){return <div aria-live="polite">{state.error&&<p className="feedback-error" role="alert">{state.error}</p>}{state.success&&<p className="feedback-success" role="status">{state.success}</p>}</div>;}
function groupCapabilities(capabilities:AccessCapability[]){
 const groups=new Map<string,AccessCapability[]>();
 for(const c of capabilities){const group=c.category||'Other';groups.set(group,[...(groups.get(group)||[]),c]);}
 const priority=['Credit','Communications','Customers','Design','Departments','Oversight','Administration'];
 return [...groups.entries()].sort(([a],[b])=>{const ai=priority.indexOf(a),bi=priority.indexOf(b);return (ai===-1?100:ai)-(bi===-1?100:bi)||a.localeCompare(b);});
}
export function RoleCapabilityMatrix({roles,permissions,grants,delegable}:{roles:AccessRole[];permissions:AccessCapability[];grants:CapabilityGrant[];delegable:string[]}){
 const active=roles.filter(r=>r.active);
 const [selected,setSelected]=useState(active[0]?.id||'');
 const role=active.find(r=>r.id===selected);
 return <section className="panel charis-access-panel">
  <div className="workspace-heading"><div><h2>Role permissions</h2><p className="muted">Set which actions a custom role allows. Changes apply to every member assigned that role.</p></div></div>
  {active.length?<>
   <label className="charis-field">Custom role<select value={selected} onChange={e=>setSelected(e.target.value)}>{active.map(r=><option value={r.id} key={r.id}>{r.name}</option>)}</select></label>
   {role&&<RoleCapabilitySelection key={role.id} role={role} permissions={permissions} grants={grants.filter(g=>g.role_id===role.id)} delegable={delegable}/>}
  </>:<p className="charis-empty">No custom roles yet. Create a role using the form above, then assign its module permissions here.</p>}
 </section>;
}
function RoleCapabilitySelection({role,permissions,grants,delegable}:{role:AccessRole;permissions:AccessCapability[];grants:CapabilityGrant[];delegable:string[]}){
 const [state,submit,pending]=useActionState(saveRoleCapabilityMatrix,{});
 const [selected,setSelected]=useState<string[]>(()=>grants.map(g=>g.permission_key));
 const groups=useMemo(()=>groupCapabilities(permissions),[permissions]);
 const hasProtected=grants.some(g=>!delegable.includes(g.permission_key));
 return <form action={submit} className="charis-matrix-form">
  <input type="hidden" name="role_id" value={role.id}/>
  <div className="charis-selection-summary"><strong>{selected.length} actions enabled</strong><span>{role.description||'Custom role'}</span></div>
  {groups.map(([group,items])=><details key={group} className="charis-action-group"><summary>{group}<small>{items.length} actions</small></summary><div className="charis-check-grid">{items.map(p=><label key={p.permission_key} className="charis-action-check">
   <input type="checkbox" name="permission_key" value={p.permission_key} disabled={!delegable.includes(p.permission_key)} checked={selected.includes(p.permission_key)} onChange={e=>setSelected(old=>e.target.checked?[...old,p.permission_key]:old.filter(k=>k!==p.permission_key))}/>
   <span><strong>{p.label}</strong><small>{p.description||p.permission_key}{!delegable.includes(p.permission_key)?' · Reserved for a higher-authority administrator':''}</small></span>
  </label>)}</div></details>)}
  {permissions.filter(p=>!delegable.includes(p.permission_key)&&selected.includes(p.permission_key)).map(p=><input key={p.permission_key} type="hidden" name="permission_key" value={p.permission_key}/>)}
  {hasProtected&&<p className="notice">This role contains higher-authority actions. Only an administrator who holds all existing role actions can modify it.</p>}
  <button className="btn" disabled={pending||hasProtected}>{pending?'Saving role…':'Save role permissions'}</button><InlineResult state={state}/>
 </form>;
}
export function StaffAccessMatrix({staff,roles,assigned,additional,permissions,direct,currentUserId,delegable,isOwner,departments,departmentMembers,canManageDepartments,departmentError}:{staff:AccessStaff[];roles:AccessRole[];assigned:AssignedRole[];additional:ExtraRole[];permissions:AccessCapability[];direct:DirectCapability[];currentUserId:string;delegable:string[];isOwner:boolean;departments:AccessDepartment[];departmentMembers:StaffDepartment[];canManageDepartments:boolean;departmentError?:boolean}){
 const [selected,setSelected]=useState(staff.find(s=>s.id!==currentUserId)?.id||staff[0]?.id||'');
 const member=staff.find(s=>s.id===selected);
 return <section className="panel charis-access-panel" id="staff-access">
  <h2>Manage staff access</h2>
  <p className="muted">Select a colleague, choose their job responsibilities, assign departments and decide what they can do. Save once to apply the changes.</p>
  {!staff.length?<p className="charis-empty">No verified staff yet. Invite colleagues through Staff & invitations before assigning access.</p>:<>
   <label className="charis-field">Staff member<select value={selected} onChange={e=>setSelected(e.target.value)}>{staff.map(m=><option key={m.id} value={m.id}>{m.email} · {m.base_role}</option>)}</select></label>
   {member&&<StaffSelection key={member.id} member={member} roles={roles} assigned={assigned} additional={additional} permissions={permissions} direct={direct} self={member.id===currentUserId} delegable={delegable} isOwner={isOwner} departments={departments} departmentMembers={departmentMembers} canManageDepartments={canManageDepartments} departmentError={departmentError}/>}
  </>}
 </section>;
}
function StaffSelection({member,roles,assigned,additional,permissions,direct,self,delegable,isOwner,departments,departmentMembers,canManageDepartments,departmentError}:{member:AccessStaff;roles:AccessRole[];assigned:AssignedRole[];additional:ExtraRole[];permissions:AccessCapability[];direct:DirectCapability[];self:boolean;delegable:string[];isOwner:boolean;departments:AccessDepartment[];departmentMembers:StaffDepartment[];canManageDepartments:boolean;departmentError?:boolean}){
 const [state,submit,pending]=useActionState(saveStaffAccessMatrix,{});
 const locked=self||(!isOwner&&member.base_role==='company_admin');
 const [primary,setPrimary]=useState(member.base_role);
 const [extra,setExtra]=useState<string[]>(()=>additional.filter(r=>r.user_id===member.id).map(r=>r.role));
 const [custom,setCustom]=useState<string[]>(()=>assigned.filter(r=>r.user_id===member.id).map(r=>r.role_id));
 const [filter,setFilter]=useState('');
 const [departmentRoles,setDepartmentRoles]=useState<Record<string,string>>(()=>Object.fromEntries(departmentMembers.filter(m=>m.user_id===member.id).map(m=>[m.department_id,m.department_role])));
 const assignedDeptCount=Object.values(departmentRoles).filter(x=>x!=='none').length;
 const [overrides,setOverrides]=useState<Record<string,string>>(()=>Object.fromEntries(direct.filter(g=>g.user_id===member.id).map(g=>[g.permission_key,g.allowed?'allow':'deny'])));
 const overrideCount=Object.values(overrides).filter(v=>v==='allow'||v==='deny').length;
 const enabled=roles.filter(r=>r.active);
 const groups=useMemo(()=>groupCapabilities(permissions.filter(p=>[p.label,p.category,p.permission_key].join(' ').toLowerCase().includes(filter.trim().toLowerCase()))),[permissions,filter]);
 return <form action={submit} className="charis-matrix-form">
  <input type="hidden" name="user_id" value={member.id}/>
  {locked&&<p className="notice" role="status">{self?'You cannot edit your own access. Select another staff member.':'Only the system owner can edit a bank administrator.'}</p>}
  <div className="charis-access-section"><h3>1. Default system role</h3><p className="muted">Sets the colleague’s baseline permissions. For roles such as Credit Officer or Operations Officer, create a custom job role below or grant module actions in step 4.</p>
   <label className="charis-field">Default role<select name="primary_role" value={primary} onChange={e=>{setPrimary(e.target.value);setExtra(old=>old.filter(x=>x!==e.target.value));}} disabled={locked}>
    {baseRoles.map(([key,label])=><option value={key} key={key} disabled={key==='company_admin'&&!isOwner}>{label}</option>)}</select></label>
  </div>
  <div className="charis-access-section"><h3>2. Additional responsibilities</h3><p className="muted">A staff member can perform more than one function without becoming a bank administrator.</p>
   <div className="charis-check-grid">{additionalRoles.map(([key,label])=><label key={key} className="charis-action-check"><input type="checkbox" name="additional_role" value={key} checked={extra.includes(key)} disabled={locked||key===primary} onChange={e=>setExtra(old=>e.target.checked?[...old,key]:old.filter(x=>x!==key))}/><span><strong>{label}</strong></span></label>)}</div>
  </div>
  <div className="charis-access-section"><h3>Custom job roles</h3>{enabled.length?<div className="charis-check-grid">{enabled.map(role=><label key={role.id} className="charis-action-check"><input type="checkbox" name="custom_role" value={role.id} checked={custom.includes(role.id)} disabled={locked} onChange={e=>setCustom(old=>e.target.checked?[...old,role.id]:old.filter(x=>x!==role.id))}/><span><strong>{role.name}</strong>{role.description&&<small>{role.description}</small>}</span></label>)}</div>:<p className="muted">No custom job roles have been created yet. Use the Create job-role template form below for roles such as Credit Officer, then assign it here after saving. You may also allow individual module actions in step 4.</p>}</div>
  <div className="charis-access-section charis-department-selector"><h3>3. Department membership</h3>
   <p className="muted">Assign this colleague to one or more of the bank’s existing departments. Department membership does not automatically grant permission to see loans or customer records.</p>
   {departmentError?<p className="feedback-error" role="alert">Department assignments could not be loaded. You can still edit roles, but no department changes will be submitted.</p>:canManageDepartments?<>
    <input type="hidden" name="departments_visible" value="yes"/>
    {departments.length?<div className="charis-department-list">{departments.map(d=>{const selectedRole=departmentRoles[d.id]||'none';return <div className="charis-department-item" key={d.id}>
      <label><input type="checkbox" checked={selectedRole!=='none'} disabled={locked} onChange={e=>setDepartmentRoles(old=>({...old,[d.id]:e.target.checked?'member':'none'}))}/><span><strong>{d.name}</strong>{d.description&&<small>{d.description}</small>}</span></label>
      <select aria-label={`Department responsibility for ${d.name}`} value={selectedRole==='none'?'member':selectedRole} disabled={locked||selectedRole==='none'} onChange={e=>setDepartmentRoles(old=>({...old,[d.id]:e.target.value}))}>
       <option value="member">Member</option><option value="head">Department head</option><option value="observer">Read-only observer</option>
      </select>
      <input type="hidden" name={`department:${d.id}`} value={selectedRole}/>
     </div>})}</div>:<p className="charis-empty">No active departments. Create one under Administration → Departments before assigning staff.</p>}
    <p className="muted">{assignedDeptCount} department(s) selected. All department changes are saved together with this staff member’s access.</p>
   </>:<p className="muted">Only staff with department management permission can change department membership.</p>}
  </div>
  <div className="charis-access-section"><div className="charis-action-header"><div><h3>4. What this staff member can do</h3><p className="muted">Open a module below to allow individual actions such as View, Create, Edit, Approve or Manage. “Use role” follows the default and additional roles. Explicit Allow or Deny overrides them.</p><p className="charis-selection-summary"><strong>{overrideCount} individual action setting(s)</strong><span>Changes apply after you save staff access.</span></p></div><input aria-label="Find a module or action" placeholder="Search module or action" value={filter} onChange={e=>setFilter(e.target.value)}/></div>
  {groups.map(([group,items],groupIndex)=><details className="charis-action-group" key={`${group}:${filter}`} open={groupIndex===0||filter.trim().length>0}><summary>{group}<small>{items.filter(p=>overrides[p.permission_key]&&overrides[p.permission_key]!=='inherit').length} customised / {items.length} actions</small></summary>
   <div className="charis-permission-table">{items.map(p=><div className="charis-permission-row" key={p.permission_key}>
    <div><strong>{p.label}</strong><small>{p.description||p.permission_key}{!delegable.includes(p.permission_key)?' · Restricted':''}</small></div>
    <select aria-label={`Permission for ${p.label}`} value={overrides[p.permission_key]||'inherit'} disabled={locked||!delegable.includes(p.permission_key)} onChange={e=>setOverrides(old=>({...old,[p.permission_key]:e.target.value}))}>
     <option value="inherit">Use role</option><option value="allow">Allow</option><option value="deny">Deny</option>
    </select></div>)}</div></details>)}
  {permissions.map(p=><input key={p.permission_key} type="hidden" name={`override:${p.permission_key}`} value={overrides[p.permission_key]||'inherit'}/>)}
  </div>
  <div className="charis-access-footer"><span className="muted">One save updates responsibilities, department membership and module actions. Changes are audited and cannot exceed your authority.</span><button type="submit" className="btn" disabled={pending||locked}>{pending?'Saving staff access…':'Save staff access'}</button></div><InlineResult state={state}/>
 </form>;
}
