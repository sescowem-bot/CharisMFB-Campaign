'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {supabaseServer} from '@/lib/supabase/server';
import {charisOrgId} from '@/lib/bank';
export type BranchResult={success?:string;error?:string};
async function bankSession(){
 const org=charisOrgId();if(!org)throw Error('Charis workspace is unavailable.');
 const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();
 if(!user?.email_confirmed_at)throw Error('Sign in to manage branch data.');
 return {db,org};
}
export async function saveBranch(_:BranchResult,form:FormData):Promise<BranchResult>{
 try{
  const parsed=z.object({id:z.union([z.literal(''),z.string().uuid()]),name:z.string().trim().min(2).max(100),code:z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,20}$/),description:z.string().max(300),active:z.enum(['yes','no'])}).parse({id:String(form.get('id')||''),name:form.get('name'),code:form.get('code'),description:form.get('description')||'',active:form.get('active')||'yes'});
  const {db,org}=await bankSession();
  const {error}=await db.rpc('charis_branch_save',{p_org:org,p_id:parsed.id||null,p_name:parsed.name,p_code:parsed.code,p_description:parsed.description,p_active:parsed.active==='yes'});
  if(error)throw Error(error.message);
  revalidatePath('/dashboard/branches');return {success:parsed.id?'Branch updated.':'Branch created.'};
 }catch(e){return {error:e instanceof Error?e.message:'Unable to update branch.'};}
}
export async function setStaffScope(_:BranchResult,form:FormData):Promise<BranchResult>{
 try{
  const parsed=z.object({staff:z.string().uuid(),bankWide:z.enum(['yes','no']),branch:z.union([z.literal(''),z.string().uuid()]),assign:z.enum(['yes','no'])}).parse({staff:form.get('staff'),bankWide:form.get('bank_wide'),branch:form.get('branch')||'',assign:form.get('assign')||'yes'});
  const {db,org}=await bankSession();
  const {error}=await db.rpc('charis_staff_scope_save',{p_org:org,p_staff:parsed.staff,p_bank_wide:parsed.bankWide==='yes',p_branch:parsed.branch||null,p_assign:parsed.assign==='yes'});
  if(error)throw Error(error.message);
  revalidatePath('/dashboard/branches');revalidatePath('/dashboard/customers');return {success:'Staff data access updated.'};
 }catch(e){return {error:e instanceof Error?e.message:'Unable to update staff access.'};}
}
export async function setCustomerLocation(_:BranchResult,form:FormData):Promise<BranchResult>{
 try{
  const parsed=z.object({contact:z.string().uuid(),branch:z.string().uuid(),department:z.union([z.literal(''),z.string().uuid()])}).parse({contact:form.get('contact'),branch:form.get('branch'),department:form.get('department')||''});
  const {db,org}=await bankSession();
  const {error}=await db.rpc('charis_customer_location_save',{p_org:org,p_contact:parsed.contact,p_branch:parsed.branch,p_department:parsed.department||null});
  if(error)throw Error(error.message);
  revalidatePath('/dashboard/branches');revalidatePath('/dashboard/customers');return {success:'Customer branch assignment saved.'};
 }catch(e){return {error:e instanceof Error?e.message:'Unable to assign customer.'};}
}
