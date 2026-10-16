 'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
import {sendDirectBatch} from '@/lib/direct/dispatch';
export type DirectState={error?:string;success?:string;id?:string};
export async function createDirectMessage(_:DirectState,form:FormData):Promise<DirectState>{
 try{
  const account=await currentAccount();if(!account)throw Error('Verified staff sign-in required');
  const org=account.workspace.id,db=await supabaseServer();
  const {data:permitted,error:permissionError}=await db.rpc('charis_direct_can_send',{p_org:org});
  if(permissionError||permitted!==true)throw Error('Your account does not have communication sending access.');
  const parsed=z.object({token:z.uuid(),title:z.string().trim().min(2).max(120),subject:z.string().trim().min(3).max(180),body:z.string().trim().min(10).max(2000),channel:z.enum(['email','sms']),purpose:z.enum(['service_notice','account_update','general_notice']),product:z.enum(['general','savings','current','fixed_deposit','loans','mobile_app','other']),audience:z.enum(['selected','list','all'])}).parse({
   token:form.get('token'),title:form.get('title'),subject:form.get('subject'),body:form.get('body'),channel:form.get('channel'),purpose:form.get('purpose'),product:form.get('product'),audience:form.get('audience')
  });
  if(process.env.CHARIS_SIMPLE_SENDING_ENABLED!=='true'||process.env.EMAIL_DELIVERY_ENABLED!=='true')throw Error('Live communications are not activated yet. Ask the administrator to complete the one-time sending setup. No message has been created.');
  if(parsed.channel==='sms'&&process.env.CHARIS_CUSTOMER_SMS_ENABLED!=='true')throw Error('Customer SMS is not activated in Vercel. No message was created.');
  if(parsed.channel==='email'){const {count,error:routesError}=await db.from('charis_direct_provider_prefs').select('provider',{head:true,count:'exact'}).eq('organization_id',org).eq('enabled',true);if(routesError||!count)throw Error('No service email sender has been authorised yet. Ask the administrator to select a verified sender once in Communication settings.');}
  const recipients=String(form.get('contact_ids')||'').split(',').filter(Boolean).map(id=>z.uuid().parse(id));
  const group=form.get('list_id')?z.uuid().parse(form.get('list_id')):null;
  const {data:id,error}=await db.rpc('charis_direct_create',{p_org:org,p_key:parsed.token,p_title:parsed.title,p_subject:parsed.subject,p_body:parsed.body,p_purpose:parsed.purpose,p_product:parsed.product,p_channel:parsed.channel,p_audience:parsed.audience,p_contact_ids:recipients,p_list:group});
  if(error||!id)throw Error(error?.message||'Unable to reserve recipients. No messages were sent.');
  const {data:message}=await db.from('charis_direct_messages').select('status').eq('organization_id',org).eq('id',id).maybeSingle();
  revalidatePath('/dashboard/communications');
  if(message?.status==='pending_approval')return {id,success:'Saved for approval because the bank has enabled approval. Nothing has been sent.'};
  if(message?.status!=='queued')return {id,success:'This message already exists. Review its delivery status before submitting again.'};
  try{
   const result=await sendDirectBatch(3,{org,message:id});
   return {id,success:result.outcomes.disabled?'Message queued. Live delivery is currently disabled; an administrator must activate it.':`Message submitted. ${result.outcomes.accepted||0} accepted by provider; remaining recipients are processed by the scheduled worker. Open Delivery history to track outcomes.`};
  }catch{return {id,success:'Message reserved, but immediate dispatch could not be confirmed. Check its delivery record and the provider before retrying.'};}
 }catch(e){return {error:e instanceof z.ZodError?'Complete the message, audience and channel details.':e instanceof Error?e.message:'Message could not be created.'};}
}
export async function approveDirectMessage(_:DirectState,form:FormData):Promise<DirectState>{
 try{const account=await currentAccount();if(!account)throw Error('Sign in first');const db=await supabaseServer();const org=account.workspace.id,id=z.uuid().parse(form.get('message_id'));
  const {error}=await db.rpc('charis_direct_approve',{p_org:org,p_id:id});if(error)throw Error(error.message);
  revalidatePath('/dashboard/communications');
  try{const result=await sendDirectBatch(3,{org,message:id});return {id,success:result.outcomes.disabled?'Approved and queued. Live sending is disabled.':`Approved. ${result.outcomes.accepted||0} recipients accepted by provider; the rest remain queued.`};}
  catch{return {id,success:'Approved and queued. Immediate provider submission could not be confirmed; review delivery status.'};}
 }catch(e){return {error:e instanceof Error?e.message:'Unable to approve message.'};}
}
