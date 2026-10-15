'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {supabaseServer} from '@/lib/supabase/server';
import {currentAccount} from '@/lib/auth/account';
export type NoticeState={error?:string;success?:string};
async function staff(key:string){
 const account=await currentAccount();
 if(!account?.permissions.includes(key))throw Error('Your account does not have permission for this action.');
 return {org:account.workspace.id,db:await supabaseServer()};
}
export async function createServiceNotice(_:NoticeState,form:FormData):Promise<NoticeState>{
 try{
  const x=z.object({contact:z.uuid(),loan:z.union([z.literal(''),z.uuid()]),channel:z.enum(['email','sms']),subject:z.string().trim().min(3).max(140),message:z.string().trim().min(10).max(1000)}).parse({
   contact:form.get('contact'),loan:form.get('loan')||'',channel:form.get('channel'),subject:form.get('subject'),message:form.get('message')
  });
  const {org,db}=await staff('service_notices.create');
  const {error}=await db.rpc('charis_service_notice_create',{p_org:org,p_contact:x.contact,p_loan:x.loan||null,p_channel:x.channel,p_subject:x.subject,p_message:x.message});
  if(error)throw Error(error.message);
  revalidatePath('/dashboard/communications/service');return {success:'Account notice saved as a draft. No message has been sent.'};
 }catch(e){return {error:e instanceof z.ZodError?'Check customer, channel and message details.':e instanceof Error?e.message:'Could not save notice.'};}
}
export async function submitServiceNotice(_:NoticeState,form:FormData):Promise<NoticeState>{
 try{
  const id=z.uuid().parse(form.get('id'));const {org,db}=await staff('service_notices.create');
  const {error}=await db.rpc('charis_service_notice_submit',{p_org:org,p_id:id});if(error)throw Error(error.message);
  revalidatePath('/dashboard/communications/service');return {success:'Submitted for independent review. Not sent.'};
 }catch(e){return {error:e instanceof Error?e.message:'Unable to submit notice.'};}
}
export async function reviewServiceNotice(_:NoticeState,form:FormData):Promise<NoticeState>{
 try{
  const x=z.object({id:z.uuid(),decision:z.enum(['approve','reject']),note:z.string().max(500)}).parse({id:form.get('id'),decision:form.get('decision'),note:form.get('note')||''});
  const {org,db}=await staff('service_notices.approve');
  const {error}=await db.rpc('charis_service_notice_review',{p_org:org,p_id:x.id,p_approve:x.decision==='approve',p_note:x.note});if(error)throw Error(error.message);
  revalidatePath('/dashboard/communications/service');return {success:x.decision==='approve'?'Draft approved for future controlled delivery; not sent.':'Returned for changes.'};
 }catch(e){return {error:e instanceof Error?e.message:'Unable to review notice.'};}
}

export async function updateServiceNotice(_:NoticeState,form:FormData):Promise<NoticeState>{
 try{
  const x=z.object({id:z.uuid(),channel:z.enum(['email','sms']),subject:z.string().trim().min(3).max(140),message:z.string().trim().min(10).max(1000)}).parse({
   id:form.get('id'),channel:form.get('channel'),subject:form.get('subject'),message:form.get('message')
  });
  const {org,db}=await staff('service_notices.create');
  const {error}=await db.rpc('charis_service_notice_update',{p_org:org,p_id:x.id,p_channel:x.channel,p_subject:x.subject,p_message:x.message});
  if(error)throw Error(error.message);
  revalidatePath('/dashboard/communications/service');return {success:'Changes saved. Submit for a new review.'};
 }catch(e){return {error:e instanceof z.ZodError?'Check notice details.':e instanceof Error?e.message:'Unable to update notice.'};}
}
