import {redirect} from 'next/navigation';
import Link from 'next/link';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
import {RoleCreationForm} from '@/components/charis-access-forms';
import {RoleCapabilityMatrix,StaffAccessMatrix,type AccessRole,type AccessCapability,type AccessStaff,type AccessDepartment,type StaffDepartment} from '@/components/charis-access-matrix';
export const dynamic='force-dynamic';
export default async function AccessManagement(){
 const account=await currentAccount();if(!account)redirect('/login');
 const org=account.workspace.id;
 if(!account.permissions.includes('access.manage'))redirect('/admin');
 const db=await supabaseServer();
 const [roles,permissions,staff,roleGrants,staffRoles,direct,additional]=await Promise.all([
  db.from('charis_access_roles').select('id,name,description,active').eq('organization_id',org).order('name'),
  db.from('charis_permission_catalog').select('permission_key,label,category,description').order('category').order('label'),
  db.rpc('charis_access_staff_list',{p_org:org}),
  db.from('charis_role_permissions').select('role_id,permission_key').eq('organization_id',org),
  db.from('charis_staff_access_roles').select('user_id,role_id').eq('organization_id',org),
  db.from('charis_staff_permissions').select('user_id,permission_key,allowed').eq('organization_id',org),
  db.from('charis_additional_roles').select('user_id,role').eq('organization_id',org)
 ]);
 const result=[roles,permissions,staff,roleGrants,staffRoles,direct,additional];
 const bad=result.filter(r=>r.error);
 const canManageDepartments=account.permissions.includes('departments.manage');
 let departments:AccessDepartment[]=[];
 let departmentMembers:StaffDepartment[]=[];
 let departmentError=false;
 if(canManageDepartments){
  const [departmentResult,membershipResult]=await Promise.all([
   db.from('charis_departments').select('id,name,description').eq('organization_id',org).eq('active',true).order('name'),
   db.from('charis_department_members').select('user_id,department_id,department_role').eq('organization_id',org).limit(500)
  ]);
  departmentError=!!(departmentResult.error||membershipResult.error)||(membershipResult.data?.length||0)>=500||(departmentResult.data?.length||0)>200;
  if(!departmentError){
   departments=(departmentResult.data||[]) as AccessDepartment[];
   departmentMembers=(membershipResult.data||[]) as StaffDepartment[];
  }
 }
 return <WorkspaceShell title="People & permissions" org={org} admin subtitle="Assign roles and decide exactly what each staff member is permitted to do.">
  <div className="actions charis-access-links">
   <Link className="btn secondary" href="/admin">Administration</Link>
   {account.permissions.includes('staff.manage')&&<Link className="btn secondary" href={`/dashboard/team?org=${org}`}>Invite and manage staff</Link>}
  </div>
  {bad.length>0?<section className="panel"><p className="feedback-error" role="alert">Staff permissions could not be loaded. Verify database migrations 027, 037 and 038 and confirm the signed-in administrator has access.</p><p className="muted">No changes were made to existing staff.</p></section>:<>
   <div className="charis-access-summary">
    <span><strong>{Array.isArray(staff.data)?staff.data.length:0}</strong><small>Verified staff</small></span>
    <span><strong>{(roles.data||[]).filter(r=>r.active).length}</strong><small>Active custom roles</small></span>
    <span><strong>{permissions.data?.length||0}</strong><small>Available actions</small></span>
   </div>
   {account.permissions.includes('staff.manage')?<StaffAccessMatrix staff={(Array.isArray(staff.data)?staff.data:[]) as AccessStaff[]}
    roles={(roles.data||[]) as AccessRole[]} assigned={staffRoles.data||[]} additional={additional.data||[]}
    permissions={(permissions.data||[]) as AccessCapability[]} direct={direct.data||[]} currentUserId={account.id} delegable={account.permissions} isOwner={account.owner} departments={departments} departmentMembers={departmentMembers} canManageDepartments={canManageDepartments&&!departmentError} departmentError={departmentError}/>:<section className="panel"><p className="muted">Staff assignment is managed by authorised bank personnel with both staff and access management permissions.</p></section>}
   <section className="panel charis-role-create" id="job-role-templates"><h2>Create a job-role template</h2><p className="muted">Examples: Credit Officer, Customer Service Officer, Marketing Supervisor. After creation, choose the role&apos;s permitted actions below.</p><RoleCreationForm/></section>
   <RoleCapabilityMatrix roles={(roles.data||[]) as AccessRole[]} permissions={(permissions.data||[]) as AccessCapability[]} grants={roleGrants.data||[]} delegable={account.permissions}/>
  </>}
 </WorkspaceShell>;
}
