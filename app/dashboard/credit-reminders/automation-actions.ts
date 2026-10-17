'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
export type AutoResult={error?:string;success?:string};
async function requireCreditPermission(permission:string){
 const account=await currentAccount();
 if(!account?.permissions.includes(permission))throw Error('You do not have permission for this action.');
 return {db:await supabaseServer(),org:account.workspace.id};
}
function failure(e:unknown):AutoResult{return {error:e instanceof z.ZodError?'Check the day offsets, channel and limit.':e instanceof Error?e.message:'Unable to update reminders.'};}
export async function saveCreditAutoRules(_:AutoResult,form:FormData):Promise<AutoResult>{
 try{
  const {db,org}=await requireCreditPermission('credit_reminders.settings');
  const text=String(form.get('offsets')||'').trim();
  if(!/^-?\d{1,2}(\s*,\s*-?\d{1,2}){0,7}$/.test(text))throw Error('Enter 1–8 reminder days separated by commas.');
  const offsets=text.split(',').map(s=>Number(s.trim()));
  if(new Set(offsets).size!==offsets.length||offsets.some(v=>!Number.isInteger(v)||v< -14||v>30))throw Error('Reminder days must be unique and between -14 and 30.');
  const channel=z.enum(['email','sms']).parse(form.get('channel'));
  const max=z.coerce.number().int().min(1).max(200).parse(form.get('max_daily'));
  const {error}=await db.rpc('charis_credit_auto_rules_save_056',{p_org:org,p_enabled:form.get('enabled')==='on',p_offsets:offsets,p_channel:channel,p_max:max});
  if(error)throw Error(error.message);
  revalidatePath('/dashboard/credit-reminders');revalidatePath('/dashboard/credit-reminders/settings');
  return {success:'Reminder rules saved.'};
 }catch(e){return failure(e);}
}
export async function scanCreditAutoSuggestions(_:AutoResult,_form:FormData):Promise<AutoResult>{
 try{
  const {db,org}=await requireCreditPermission('credit_reminders.settings');
  const {data,error}=await db.rpc('charis_credit_auto_generate_056',{p_org:org});
  if(error)throw Error(error.message);
  revalidatePath('/dashboard/credit-reminders');
  return {success:`${Number(data||0)} new due reminders found.`};
 }catch(e){return failure(e);}
}
export async function dismissCreditAutoSuggestion(_:AutoResult,form:FormData):Promise<AutoResult>{
 try{
  const {db,org}=await requireCreditPermission('credit_reminders.create');
  const id=z.uuid().parse(form.get('id'));
  const {error}=await db.rpc('charis_credit_auto_resolve_056',{p_org:org,p_id:id,p_action:'dismiss',p_batch:null});
  if(error)throw Error(error.message);
  revalidatePath('/dashboard/credit-reminders');
  return {success:'Dismissed.'};
 }catch(e){return failure(e);}
}
