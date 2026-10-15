'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {supabaseServer} from '@/lib/supabase/server';
import {emailServiceDb} from '@/lib/email/server';
import {providerAdapter} from '@/lib/email/providers';
import {charisOrgId} from '@/lib/bank';
export type ProviderResult={error?:string;success?:string};
export async function providerAction(_:ProviderResult,form:FormData):Promise<ProviderResult> {
 try {
  const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)throw new Error('Verified sign-in required.');
  const org=charisOrgId();if(!org)throw new Error('Charis workspace is not configured.');
  const {data:charisAdmin,error:accessError}=await db.rpc('can_manage_senders',{p_org:org});
  if(accessError||charisAdmin!==true)throw new Error('Charis provider administration permission required.');
  const provider=z.enum(['resend','brevo','mailjet']).parse(form.get('provider'));
  if(form.get('action')==='save') {
   if(provider==='mailjet' && form.get('enabled')==='on' && (!process.env.MAILJET_API_KEY||!process.env.MAILJET_SECRET_KEY||!(process.env.MAILJET_WEBHOOK_SECRET||'').length || (process.env.MAILJET_WEBHOOK_SECRET||'').length<32))throw new Error('Mailjet requires API credentials and a secure delivery webhook secret before enabling.');
   const {error}=await db.rpc('charis_provider_configure',{p_org:org,p_provider:provider,p_enabled:form.get('enabled')==='on'});if(error)throw new Error(error.message);
  } else if(form.get('action')==='limits') {
   const daily=z.coerce.number().int().min(1).max(100000).parse(form.get('daily_limit'));
   const interval=z.coerce.number().int().min(1).max(3600).parse(form.get('minimum_interval_seconds'));
   const {error}=await db.rpc('charis_provider_configure',{p_org:org,p_provider:provider,p_daily:daily,p_interval:interval});if(error)throw new Error(error.message);
  } else if(form.get('action')==='health') {
   const key=process.env[provider==='resend'?'RESEND_API_KEY':provider==='brevo'?'BREVO_API_KEY':'MAILJET_API_KEY']||'';
   const service=emailServiceDb();
   const {data:settings}=await service.from('email_provider_settings').select('checked_at').eq('provider',provider).single();
   if(settings?.checked_at&&Date.now()-Date.parse(settings.checked_at)<30000)throw new Error('Wait 30 seconds before checking again.');
   let healthy=true;try{await providerAdapter(provider,key).health();}catch{healthy=false;}
   const {error}=await service.from('email_provider_settings').update({health_status:healthy?'healthy':'error',checked_at:new Date().toISOString()}).eq('provider',provider);
   if(error)throw new Error('Provider health could not be recorded.');
   revalidatePath('/admin/providers');return healthy?{success:'Provider API connection verified. This does not confirm delivery or sending allowance.'}:{error:'Provider connection failed. Check the server API key, account permissions and provider dashboard.'};
  } else throw new Error('Unknown operation.');
  revalidatePath('/admin/providers');return {success:'Provider settings saved.'};
 }catch(e){return {error:e instanceof Error?e.message:'Provider request failed.'};}
}
