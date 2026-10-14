'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {supabaseServer} from '@/lib/supabase/server';
export type DepartmentActionResult={error?:string;success?:string};
export async function assignDepartment(_:DepartmentActionResult,form:FormData):Promise<DepartmentActionResult>{
 try{
  const org=z.string().uuid().parse(form.get('org'));
  const department=z.string().uuid().parse(form.get('department_id'));
  const user=z.string().uuid().parse(form.get('user_id'));
  const role=z.enum(['head','member','observer']).parse(form.get('department_role'));
  const remove=form.get('remove')==='yes';
  const db=await supabaseServer();
  const {data:{user:actor}}=await db.auth.getUser();
  if(!actor?.email_confirmed_at)throw Error('Please sign in to manage staff.');
  const {error}=await db.rpc('charis_department_assign',{p_org:org,p_dept:department,p_user:user,p_role:role,p_remove:remove});
  if(error)throw Error(error.message);
  revalidatePath('/dashboard/departments');revalidatePath('/dashboard/reminders');
  return {success:remove?'Staff member removed from the department.':'Department access updated.'};
 }catch(e){return {error:e instanceof Error?e.message:'Unable to update department access.'};}
}
