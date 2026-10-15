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
