'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {supabaseServer} from '@/lib/supabase/server';
import {emailServiceDb} from '@/lib/email/server';
import {providerAdapter} from '@/lib/email/providers';
import {mailbox,senderName,domainName} from '@/lib/email/validation';

type State={error?:string;success?:string};
const providerSchema=z.enum(['resend','brevo','mailjet']);
async function access(){
 const org=z.string().uuid().parse(process.env.SINGLE_COMPANY_ORG_ID);
 const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();
 if(!user?.email_confirmed_at)throw new Error('Sign in with a verified email.');
 const {data:admin}=await db.rpc('can_manage_senders',{p_org:org});
 if(!admin)throw new Error('Charis sender administrator access required.');
 return {db,user,org};
}
/** Explicit route configuration. Marketing only with an adapter designed for that use. */
export async function saveDeliveryRoute(_:State,form:FormData):Promise<State>{
 try{
  const {db,org}=await access();
  const provider=providerSchema.parse(form.get('provider'));
  const sender=z.string().uuid().parse(form.get('sender_id'));
  const kind=z.enum(['service','marketing']).parse(form.get('kind'));
  const enabled=form.get('enabled')==='on';
  const confirmed=form.get('confirmed')==='on';
  if(enabled&&kind==='marketing'&&provider==='brevo')throw new Error('Brevo transactional API cannot be used for promotional broadcasts. Resend marketing uses the separate Broadcasts adapter.');
  const {error}=await db.rpc('charis_email_route_save',{p_org:org,p_provider:provider,p_sender:sender,p_enabled:enabled,p_confirmed:confirmed,p_kind:kind});
  if(error)throw new Error(error.message);
  revalidatePath('/admin/providers');return {success:'Delivery route updated. This does not enable live customer sending.'};
 }catch(e){return {error:e instanceof Error?e.message:'Route setup failed.'};}
}
/** Import an already verified Brevo sender/domain; no DNS changes or sender creation. */
export async function connectVerifiedBrevoSender(_:State,form:FormData):Promise<State>{
 try{
  const {org,user}=await access();
  const email=mailbox(String(form.get('email')||''));
  const name=senderName(String(form.get('name')||''));
  const replyTo=mailbox(String(form.get('reply_to')||'')||email);
  const domain=domainName(email.split('@')[1]);
  const api=providerAdapter('brevo',process.env.BREVO_API_KEY||'');
  const verified=await api.findVerifiedBrevoSender(email);
  if(verified.domain!==domain)throw new Error('Domain mismatch.');
  const service=emailServiceDb();
  const {data:existing,error:read}=await service.from('sending_domains').select('id,verification_status').eq('organization_id',org).eq('provider','brevo').eq('domain',domain).maybeSingle();
  if(read||existing?.verification_status==='revoked')throw new Error('Brevo sender domain requires administrator review.');
  let domainId=existing?.id;
  if(domainId){
   const {error}=await service.from('sending_domains').update({verification_status:'verified',provider_domain_id:verified.id,ownership_method:'provider_account',charis_connected:true,last_checked_at:new Date().toISOString()}).eq('id',domainId);
   if(error)throw new Error('Could not refresh Brevo domain.');
  }else{
   const {data,error}=await service.from('sending_domains').insert({organization_id:org,domain,provider:'brevo',provider_domain_id:verified.id,verification_status:'verified',ownership_method:'provider_account',charis_connected:true,created_by:user.id}).select('id').single();
   if(error||!data)throw new Error('Could not save Brevo domain.');domainId=data.id;
  }
  const {error:senderError}=await service.from('sender_identities').upsert({organization_id:org,domain_id:domainId,from_name:name,from_email:email,reply_to:replyTo,is_active:true},{onConflict:'organization_id,domain_id,from_email'});
  if(senderError)throw new Error('Could not save verified Brevo sender.');
  await service.from('audit_logs').insert({organization_id:org,actor_id:user.id,action:'sender.brevo_verified',entity_type:'sending_domain',entity_id:domainId});
  revalidatePath('/admin/providers');return {success:'Brevo sender verified and saved. Configure its route before sending.'};
 }catch(e){return {error:e instanceof Error?e.message:'Brevo sender setup failed.'};}
}
/** Connect a sender already active in the bank's Mailjet account; never register DNS implicitly. */
export async function connectVerifiedMailjetSender(_:State,form:FormData):Promise<State>{
 try{
  const {org,user}=await access();
  const email=mailbox(String(form.get('email')||''));
  const name=senderName(String(form.get('name')||''));
  const replyTo=mailbox(String(form.get('reply_to')||'')||email);
  const domain=domainName(email.split('@')[1]);
  const api=providerAdapter('mailjet',process.env.MAILJET_API_KEY||'');
  const verified=await api.findVerifiedMailjetSender(email);
  const state=await api.check(domain,verified.id);
  if(!state.verified)throw new Error('Mailjet sender is not active.');
  const service=emailServiceDb();
  const {data:existing,error:read}=await service.from('sending_domains').select('id,verification_status').eq('organization_id',org).eq('provider','mailjet').eq('domain',domain).maybeSingle();
  if(read)throw new Error('Mailjet sender record unavailable.');
  if(existing?.verification_status==='revoked')throw new Error('Domain was previously revoked by an administrator.');
  let domainId=existing?.id;
  if(domainId){
   const {error}=await service.from('sending_domains').update({verification_status:'verified',provider_domain_id:verified.id,ownership_method:'provider_account',charis_connected:true,last_checked_at:new Date().toISOString()}).eq('id',domainId).eq('organization_id',org);
   if(error)throw new Error('Could not update Mailjet domain.');
  }else{
   const {data,error}=await service.from('sending_domains').insert({organization_id:org,domain,provider:'mailjet',provider_domain_id:verified.id,verification_status:'verified',ownership_method:'provider_account',charis_connected:true,created_by:user.id}).select('id').single();
   if(error||!data)throw new Error('Could not save Mailjet domain.');domainId=data.id;
  }
  const {error:senderError}=await service.from('sender_identities').upsert({organization_id:org,domain_id:domainId,from_name:name,from_email:email,reply_to:replyTo,is_active:true},{onConflict:'organization_id,domain_id,from_email'});
  if(senderError)throw new Error('Could not save verified Mailjet sender.');
  await service.from('audit_logs').insert({organization_id:org,actor_id:user.id,action:'sender.mailjet_verified',entity_type:'sending_domain',entity_id:domainId});
  revalidatePath('/admin/providers');return {success:'Mailjet sender verified and saved. Configure its route before sending.'};
 }catch(e){return {error:e instanceof Error?e.message:'Mailjet sender setup failed.'};}
}

export async function saveEmailMonthlyBudget(_:State,form:FormData):Promise<State>{
 try{
  const {db,org}=await access();
  const limit=z.coerce.number().int().min(1).max(1000000).parse(form.get('monthly_limit'));
  const {error}=await db.rpc('charis_email_budget_save',{p_org:org,p_limit:limit});
  if(error)throw new Error(error.message);
  revalidatePath('/admin/providers');return {success:'Charis monthly email limit saved.'};
 }catch(e){return {error:e instanceof Error?e.message:'Monthly limit could not be saved.'};}
}
