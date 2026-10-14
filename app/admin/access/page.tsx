import {redirect} from 'next/navigation';
import Link from 'next/link';
import {z} from 'zod';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
import {RoleCreationForm,RoleGrantForm,StaffRoleForm,IndividualPermissionForm} from '@/components/charis-access-forms';
export const dynamic='force-dynamic';
type Role={id:string;name:string;description:string;active:boolean};
type Permission={permission_key:string;label:string;category:string;description:string};
type Staff={id:string;email:string;base_role:string};
export default async function AccessManagement(){
 const org=z.string().uuid().safeParse(process.env.SINGLE_COMPANY_ORG_ID);
 if(!org.success)redirect('/setup-required');
 const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const {data:allowed}=await db.rpc('charis_has_permission',{p_org:org.data,p_key:'access.manage'});
 if(!allowed)redirect('/dashboard');
 const [roles,permissions,staff,roleGrants,staffRoles,direct]=await Promise.all([
  db.from('charis_access_roles').select('id,name,description,active').eq('organization_id',org.data).order('name'),
  db.from('charis_permission_catalog').select('permission_key,label,category,description').order('category').order('label'),
  db.rpc('charis_access_staff_list',{p_org:org.data}),
  db.from('charis_role_permissions').select('role_id,permission_key').eq('organization_id',org.data),
  db.from('charis_staff_access_roles').select('user_id,role_id').eq('organization_id',org.data),
  db.from('charis_staff_permissions').select('user_id,permission_key,allowed').eq('organization_id',org.data)
 ]);
 const error=[roles,permissions,staff,roleGrants,staffRoles,direct].some(r=>r.error);
 return <WorkspaceShell title="Roles & permissions" org={org.data} admin subtitle="Manage delegated access to Charis modules and operations.">
  <div className="actions"><Link className="btn secondary" href="/dashboard/team">Staff invitations</Link><Link className="btn secondary" href="/dashboard/departments">Departments</Link></div>
  {error&&<p className="feedback-error" role="alert">Access settings are unavailable. Ask the system owner to complete the database setup.</p>}
  {!error&&<>
   <section className="stat-grid"><div className="stat"><span className="stat-label">Custom roles</span><strong className="stat-value">{roles.data?.length||0}</strong></div><div className="stat"><span className="stat-label">Verified staff</span><strong className="stat-value">{Array.isArray(staff.data)?staff.data.length:0}</strong></div><div className="stat"><span className="stat-label">Capabilities</span><strong className="stat-value">{permissions.data?.length||0}</strong></div></section>
   <div className="admin-columns"><section className="panel"><h2>Create a custom role</h2><RoleCreationForm/></section><section className="panel"><h2>Role capabilities</h2><RoleGrantForm roles={(roles.data||[]) as Role[]} permissions={(permissions.data||[]) as Permission[]} grants={roleGrants.data||[]}/></section></div>
   <div className="admin-columns"><section className="panel"><h2>Assign roles to staff</h2><StaffRoleForm staff={(Array.isArray(staff.data)?staff.data:[]) as Staff[]} roles={(roles.data||[]) as Role[]} assigned={staffRoles.data||[]}/></section><section className="panel"><h2>Individual permission overrides</h2><IndividualPermissionForm staff={(Array.isArray(staff.data)?staff.data:[]) as Staff[]} permissions={(permissions.data||[]) as Permission[]} grants={direct.data||[]}/></section></div>
   <section className="panel"><h2>Permission directory</h2><div className="table-scroll"><table className="admin-table"><thead><tr><th>Area</th><th>Permission</th><th>What it controls</th></tr></thead><tbody>{(permissions.data||[]).map(p=><tr key={p.permission_key}><td>{p.category}</td><td><strong>{p.label}</strong><div className="muted">{p.permission_key}</div></td><td>{p.description}</td></tr>)}</tbody></table></div></section>
  </>}
 </WorkspaceShell>;
}
