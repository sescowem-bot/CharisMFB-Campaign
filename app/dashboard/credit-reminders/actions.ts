'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
export type CreditReminderResult={error?:string;success?:string};
async function allowed(permission:string){
 const user=await currentAccount();
 if(!user?.permissions.includes(permission))throw Error('You are not authorised to perform this action.');
 return {db:await supabaseServer(),org:user.workspace.id};
}
function fail(error:unknown):CreditReminderResult{
 if(error instanceof z.ZodError)return {error:'Check the selected loans, reminder text and required fields.'};
 return {error:error instanceof Error?error.message:'The requested action could not be completed.'};
}
export async function createCreditReminder(_:CreditReminderResult,form:FormData):Promise<CreditReminderResult>{
 try{
  const values=z.object({
   loans:z.array(z.uuid()).min(1).max(50),channel:z.enum(['email','sms']),
   subject:z.string().trim().min(3).max(140),message:z.string().trim().min(15).max(800),
   key:z.uuid(),reconciled:z.literal('yes')
  }).parse({loans:form.getAll('loans').map(String),channel:form.get('channel'),subject:form.get('subject'),message:form.get('message'),key:form.get('key'),reconciled:form.get('reconciled')});
  if(new Set(values.loans).size!==values.loans.length)throw Error('Select each loan once.');
  const {db,org}=await allowed('credit_reminders.create');
  const {error}=await db.rpc('charis_credit_reminder_create',{
   p_org:org,p_loans:values.loans,p_channel:values.channel,p_subject:values.subject,
   p_template:values.message,p_key:values.key,p_reconciled:true
  });
  if(error)throw Error(error.message);
  revalidatePath('/dashboard/credit-reminders');
  return {success:'Credit reminder batch saved as a draft. No email or SMS has been sent.'};
 }catch(error){return fail(error);}
}
export async function transitionCreditReminder(_:CreditReminderResult,form:FormData):Promise<CreditReminderResult>{
 try{
  const v=z.object({id:z.uuid(),decision:z.enum(['submit','approve','reject','hold','cancel']),note:z.string().max(500)}).parse({
   id:form.get('id'),decision:form.get('decision'),note:form.get('note')||''
  });
  const permissions:Record<typeof v.decision,string>={submit:'credit_reminders.create',approve:'credit_reminders.approve',reject:'credit_reminders.approve',hold:'credit_reminders.queue',cancel:'credit_reminders.create'};
  const {db,org}=await allowed(permissions[v.decision]);
  const {error}=await db.rpc('charis_credit_reminder_transition',{p_org:org,p_batch:v.id,p_action:v.decision,p_note:v.note});
  if(error)throw Error(error.message);
  revalidatePath('/dashboard/credit-reminders');
  const notice:Record<typeof v.decision,string>={
   submit:'Submitted to the review queue. No messages were sent.',
   approve:'Reminder batch approved, but not sent.',
   reject:'Returned to the drafter; no messages sent.',
   hold:'Delivery records created and held. Customer sending remains disabled.',
   cancel:'Reminder batch cancelled.'
  };
  return {success:notice[v.decision]};
 }catch(error){return fail(error);}
}
export async function saveCreditReminderPolicy(_:CreditReminderResult,form:FormData):Promise<CreditReminderResult>{
 try{
  const v=z.object({mode:z.enum(['independent','authorised_direct']),limit:z.coerce.number().int().min(1).max(500)}).parse({mode:form.get('mode'),limit:form.get('limit')});
  const {db,org}=await allowed('credit_reminders.settings');
  const {error}=await db.rpc('charis_credit_policy_set',{p_org:org,p_mode:v.mode,p_limit:v.limit});
  if(error)throw Error(error.message);
  revalidatePath('/dashboard/credit-reminders/settings');revalidatePath('/dashboard/credit-reminders');
  return {success:'Credit reminder approval settings updated. Delivery remains disabled.'};
 }catch(error){return fail(error);}
}
