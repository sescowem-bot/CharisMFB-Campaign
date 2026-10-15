'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {supabaseServer} from '@/lib/supabase/server';

type Outcome={error?:string;success?:string};
async function bankAccess(){
 const org=z.string().uuid().parse(process.env.SINGLE_COMPANY_ORG_ID);
 const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();
 if(!user?.email_confirmed_at)throw Error('Sign in to continue.');
 const {data:allowed,error}=await db.rpc('charis_has_permission',{p_org:org,p_key:'access.manage'});
 if(error||allowed!==true)throw Error('Permission management is unavailable for this account.');
 return {db,org};
}
function fail(e:unknown):Outcome{return {error:e instanceof Error?e.message:'Unable to save changes.'};}
export async function saveCustomRole(_:Outcome,form:FormData):Promise<Outcome>{
 try{
  const {db,org}=await bankAccess();const name=z.string().trim().min(3).max(80).parse(form.get('name'));
  const description=z.string().max(300).parse(form.get('description')||'');
  const raw=form.get('role_id');const id=raw?z.string().uuid().parse(raw):null;
  const {error}=await db.rpc('charis_access_role_save',{p_org:org,p_role:id,p_name:name,p_description:description,p_active:form.get('active')!=='no'});
  if(error)throw Error(error.message);revalidatePath('/admin/access');return {success:'Role saved.'};
 }catch(e){return fail(e);}
}
export async function changeRolePermission(_:Outcome,form:FormData):Promise<Outcome>{
 try{
  const {db,org}=await bankAccess();const role=z.string().uuid().parse(form.get('role_id'));
  const key=z.string().min(3).max(70).parse(form.get('permission_key'));
  const {error}=await db.rpc('charis_role_permission_set',{p_org:org,p_role:role,p_key:key,p_allowed:form.get('allowed')==='yes'});
  if(error)throw Error(error.message);revalidatePath('/admin/access');return {success:'Role permissions updated.'};
 }catch(e){return fail(e);}
}
export async function changeStaffRole(_:Outcome,form:FormData):Promise<Outcome>{
 try{
  const {db,org}=await bankAccess();const staff=z.string().uuid().parse(form.get('user_id'));
  const role=z.string().uuid().parse(form.get('role_id'));
  const {error}=await db.rpc('charis_staff_role_set',{p_org:org,p_user:staff,p_role:role,p_assign:form.get('assign')==='yes'});
  if(error)throw Error(error.message);revalidatePath('/admin/access');return {success:'Staff role updated.'};
 }catch(e){return fail(e);}
}
// Apply a complete set of custom roles atomically in the database.
// Built-in primary and supplementary responsibilities remain managed in Team Access.
export async function saveStaffCustomRoles(_:Outcome,form:FormData):Promise<Outcome>{
 try{
  const {db,org}=await bankAccess();
  const staff=z.string().uuid().parse(form.get('user_id'));
  const roleIds=z.array(z.string().uuid()).max(30).parse(form.getAll('role_id'));
  if(new Set(roleIds).size!==roleIds.length)throw Error('Duplicate roles in selection.');
  const {error}=await db.rpc('charis_staff_roles_sync',{
   p_org:org,p_user:staff,p_roles:roleIds
  });
  if(error)throw Error(error.message);
  revalidatePath('/admin/access');
  return {success:'Staff custom roles saved. Changes to staff access are audited.'};
 }catch(e){return fail(e);}
}
export async function changeStaffPermission(_:Outcome,form:FormData):Promise<Outcome>{
 try{
  const {db,org}=await bankAccess();const staff=z.string().uuid().parse(form.get('user_id'));
  const key=z.string().min(3).max(70).parse(form.get('permission_key'));
  const {error}=await db.rpc('charis_staff_permission_set',{p_org:org,p_user:staff,p_key:key,p_allowed:form.get('allowed')==='yes'});
  if(error)throw Error(error.message);revalidatePath('/admin/access');return {success:'Individual access updated.'};
 }catch(e){return fail(e);}
}

// One save handles all selected module actions for a custom role.
export async function saveRoleCapabilityMatrix(_:Outcome,form:FormData):Promise<Outcome>{
 try{
  const {db,org}=await bankAccess();
  const role=z.string().uuid().parse(form.get('role_id'));
  const keys=z.array(z.string().min(3).max(70)).max(150).parse(form.getAll('permission_key'));
  if(new Set(keys).size!==keys.length)throw Error('Duplicate permissions.');
  const {error}=await db.rpc('charis_role_permissions_replace',{p_org:org,p_role:role,p_keys:keys});
  if(error)throw Error(error.message);
  revalidatePath('/admin/access');revalidatePath('/dashboard');
  return {success:'Role capabilities updated.'};
 }catch(e){return fail(e);}
}

// Apply primary, supplementary and custom roles alongside individual actions
// in a single audited SQL transaction. Never accept an org ID from the form.
export async function saveStaffAccessMatrix(_:Outcome,form:FormData):Promise<Outcome>{
 try{
  const {db,org}=await bankAccess();
  const staff=z.string().uuid().parse(form.get('user_id'));
  const primary=z.enum(['company_admin','manager','campaign_lead','designer','approver','analyst','viewer']).parse(form.get('primary_role'));
  const additional=z.array(z.enum(['manager','campaign_lead','designer','approver','analyst','viewer'])).max(6).parse(form.getAll('additional_role'));
  const custom=z.array(z.string().uuid()).max(30).parse(form.getAll('custom_role'));
  if(new Set(additional).size!==additional.length||new Set(custom).size!==custom.length)throw Error('Duplicate role selection.');
  const overrides:Record<string,string>={};
  for(const [name,value] of form.entries()){
   if(!name.startsWith('override:'))continue;
   const key=name.slice(9);
   if(!/^[a-z][a-z0-9_.]{2,70}$/.test(key)||typeof value!=='string'||!['allow','deny','inherit'].includes(value))throw Error('Invalid module permission');
   if(Object.prototype.hasOwnProperty.call(overrides,key))throw Error('Duplicate permission selection');
   overrides[key]=value;
  }
  if(Object.keys(overrides).length>150)throw Error('Too many permission changes');
  // Null means the caller did not load department administration. The database
  // will leave all department memberships unchanged in that case.
  let departmentChanges:Record<string,string>|null=null;
  if(form.get('departments_visible')==='yes'){
   departmentChanges={};
   for(const [name,value] of form.entries()){
    if(!name.startsWith('department:'))continue;
    const id=z.string().uuid().parse(name.slice('department:'.length));
    const deptRole=z.enum(['none','member','head','observer']).parse(value);
    if(Object.prototype.hasOwnProperty.call(departmentChanges,id))throw Error('Duplicate department selection');
    departmentChanges[id]=deptRole;
   }
   if(Object.keys(departmentChanges).length>200)throw Error('Too many department selections');
  }
  const {error}=await db.rpc('charis_staff_profile_save',{
   p_org:org,p_user:staff,p_primary:primary,p_additional:additional,p_custom:custom,p_overrides:overrides,p_departments:departmentChanges
  });
  if(error)throw Error(error.message);
  revalidatePath('/admin/access');revalidatePath('/dashboard/team');revalidatePath('/dashboard/departments');revalidatePath('/dashboard');
  return {success:'Staff access saved. Roles, module actions and selected departments are now updated.'};
 }catch(e){return fail(e);}
}
