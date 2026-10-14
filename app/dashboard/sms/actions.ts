'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {supabaseServer} from '@/lib/supabase/server';
import {createClient} from '@supabase/supabase-js';
import {sendTermiiStaffTest,smsTestConfigured} from '@/lib/sms/termii';
export type SmsResult={error?:string;success?:string;id?:string};
export async function smsAction(_:SmsResult,form:FormData):Promise<SmsResult>{
 try{
  const org=z.string().uuid().parse(form.get('org'));
  if(org!==process.env.SINGLE_COMPANY_ORG_ID)throw Error('Invalid Charis workspace.');
  const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();
  if(!user?.email_confirmed_at)throw Error('Sign in with a verified staff account.');
  const action=z.enum(['save','submit','approve','reject','withdraw','test']).parse(form.get('action'));
  if(action==='save'){
   const id=form.get('id')?z.string().uuid().parse(form.get('id')):null;
   const audience=z.enum(['all','list']).parse(form.get('audience_type'));
   const {data,error}=await db.rpc('charis_sms_save',{p_org:org,p_id:id,p_title:z.string().trim().min(2).max(120).parse(form.get('title')),p_message:z.string().trim().min(1).max(480).parse(form.get('message')),p_purpose:z.enum(['marketing','service_notice']).parse(form.get('purpose')),p_audience_type:audience,p_audience:audience==='list'?z.string().uuid().parse(form.get('audience_id')):null});
   if(error)throw Error(error.message);
   revalidatePath('/dashboard/sms');return {id:data,success:'SMS draft saved. You can now send a staff test or submit it for approval.'};
  }
  const id=z.string().uuid().parse(form.get('id'));
  if(action==='test'){
   if(!smsTestConfigured())throw Error('SMS test sending is not configured.');
   const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY,apiUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
   if(!serviceKey||!apiUrl)throw Error('Server SMS audit service is not configured.');
   const {data:campaign,error:loadError}=await db.from('charis_sms_campaigns').select('message').eq('organization_id',org).eq('id',id).single();
   if(loadError||!campaign)throw Error('Saved SMS draft unavailable.');
   const {data:attempt,error:reserveError}=await db.rpc('charis_sms_test_reserve',{p_org:org,p_id:id});
   if(reserveError)throw Error(reserveError.message);
   const outcome=await sendTermiiStaffTest(campaign.message);
   const service=createClient(apiUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
   const {error:finishError}=await service.rpc('charis_sms_test_finish',{p_org:org,p_attempt:attempt,p_actor:user.id,p_status:outcome.status,p_provider_id:outcome.id||null});
   if(finishError)throw Error('SMS provider request completed but the audit log could not be updated. Check Termii before retrying.');
   revalidatePath('/dashboard/sms');
   return outcome.status==='accepted'?{success:outcome.message}:{error:outcome.message};
  }
  const {error}=await db.rpc('charis_sms_transition',{p_org:org,p_id:id,p_action:action,p_note:z.string().max(600).parse(form.get('note')||'')});
  if(error)throw Error(error.message);
  revalidatePath('/dashboard/sms');return {success:`SMS campaign ${action==='approve'?'approved (not sent)':action==='reject'?'rejected':action==='submit'?'submitted for review':'withdrawn to draft'}.`};
 }catch(e){return {error:e instanceof Error?e.message:'SMS request failed.'};}
}
