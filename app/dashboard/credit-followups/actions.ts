'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
export type FollowupResult={error?:string;success?:string};
const dateSchema=z.string().datetime({offset:true});
function errorText(error:unknown){return error instanceof Error?error.message:'Unable to update the follow-up.';}
export async function createCreditFollowup(_:FollowupResult,form:FormData):Promise<FollowupResult>{
 try{
  const payload=z.object({loan:z.string().uuid(),assigned:z.string().uuid(),due:dateSchema,
   priority:z.enum(['low','normal','high']),notes:z.string().max(1200),key:z.string().uuid()}).parse({
    loan:form.get('loan'),assigned:form.get('assigned'),due:form.get('due'),
    priority:form.get('priority'),notes:form.get('notes')||'',key:form.get('key')
   });
  const account=await currentAccount();
  if(!account?.permissions.includes('credit_followups.create')||!account.permissions.includes('loans.view')||!account.permissions.some(p=>p==='credit_followups.view'||p==='credit_followups.manage'))throw Error('Credit follow-up access is required.');
  const db=await supabaseServer();
  const {error}=await db.rpc('charis_credit_followup_create',{
   p_org:account.workspace.id,p_loan:payload.loan,p_assignee:payload.assigned,p_due:payload.due,
   p_priority:payload.priority,p_notes:payload.notes,p_key:payload.key
  });
  if(error)throw Error(error.message);
  revalidatePath('/dashboard/credit-followups');revalidatePath('/dashboard/notifications');
  return {success:'Internal loan follow-up saved. No customer message was sent.'};
 }catch(e){return {error:errorText(e)};}
}
export async function changeCreditFollowup(_:FollowupResult,form:FormData):Promise<FollowupResult>{
 try{
  const v=z.object({id:z.string().uuid(),status:z.enum(['open','done','cancelled'])}).parse({id:form.get('id'),status:form.get('status')});
  const account=await currentAccount();
  if(!account?.permissions.some(p=>p==='credit_followups.view'||p==='credit_followups.manage'))throw Error('Follow-up access is required.');
  const db=await supabaseServer();const {error}=await db.rpc('charis_credit_followup_status',{
   p_org:account.workspace.id,p_id:v.id,p_status:v.status
  });
  if(error)throw Error(error.message);
  revalidatePath('/dashboard/credit-followups');revalidatePath('/dashboard/notifications');
  return {success:'Follow-up updated.'};
 }catch(e){return {error:errorText(e)};}
}
