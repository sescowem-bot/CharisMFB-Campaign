'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {supabaseServer} from '@/lib/supabase/server';
import {emailServiceDb} from '@/lib/email/server';
import {providerAdapter} from '@/lib/email/providers';
import {mailbox,senderName,domainName} from '@/lib/email/validation';
import {isCharisSenderDomain,isCharisSenderEmail} from '@/lib/email/charis-sender';

type State={error?:string;success?:string};
const providerSchema=z.enum(['sendbyte','resend','brevo']);
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
  const {data:identity,error:identityError}=await db.from('sender_identities').select('from_email,is_active').eq('organization_id',org).eq('id',sender).maybeSingle();
  if(identityError||!identity?.is_active||!isCharisSenderEmail(identity.from_email))throw Error('Choose an approved Charis bank sending address.');
  if(enabled&&kind==='marketing'&&provider==='brevo')throw new Error('Brevo is currently configured for service updates only.');
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
  if(!isCharisSenderDomain(domain))throw Error('Only verified Charis bank senders are available.');
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
  const {error:senderError}=await service.from('sender_identities').upsert({organization_id:org,domain_id:domainId,from_name:name,from_email:email,reply_to:replyTo,is_active:true},{onConflict:'organization_id,from_email'});
  if(senderError)throw new Error('Could not save verified Brevo sender.');
  await service.from('audit_logs').insert({organization_id:org,actor_id:user.id,action:'sender.brevo_verified',entity_type:'sending_domain',entity_id:domainId});
  revalidatePath('/admin/providers');return {success:'Brevo sender verified and saved. Configure its route before sending.'};
 }catch(e){return {error:e instanceof Error?e.message:'Brevo sender setup failed.'};}
}
/** Connect a domain already authenticated in SendByte and its Charis sender address. */
export async function connectVerifiedSendByteSender(_:State,form:FormData):Promise<State>{
 try{
  const {org,user}=await access();
  const email=mailbox(String(form.get('email')||'')),name=senderName(String(form.get('name')||''));
  const replyTo=mailbox(String(form.get('reply_to')||'')||email),domain=domainName(email.split('@')[1]);
  if(!isCharisSenderDomain(domain))throw Error('Only approved Charis bank domains can be connected.');
  const api=providerAdapter('sendbyte',process.env.SENDBYTE_API_KEY||'');
  const verified=await api.findVerifiedSendByteDomain(domain);
  const service=emailServiceDb();
  const {data:existing,error:read}=await service.from('sending_domains').select('id,verification_status').eq('organization_id',org).eq('provider','sendbyte').eq('domain',domain).maybeSingle();
  if(read||existing?.verification_status==='revoked')throw Error('SendByte domain requires administrator review.');
  let domainId=existing?.id;
  const values={provider:'sendbyte',provider_domain_id:verified.id,verification_status:'verified',charis_connected:true,dns_records:verified.records,ownership_method:'provider_account',last_checked_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  if(domainId){
   const {error}=await service.from('sending_domains').update(values).eq('organization_id',org).eq('id',domainId);
   if(error)throw Error('Could not update the verified SendByte domain.');
  }else{
   const {data,error}=await service.from('sending_domains').insert({...values,organization_id:org,domain,created_by:user.id}).select('id').single();
   if(error||!data)throw Error('Could not save the verified SendByte domain.');domainId=data.id;
  }
  const {error:senderError}=await service.from('sender_identities').upsert({organization_id:org,domain_id:domainId,from_name:name,from_email:email,reply_to:replyTo,is_active:true},{onConflict:'organization_id,from_email'});
  if(senderError)throw Error('Could not save the SendByte sender address.');
  const {error:enableError}=await service.from('email_provider_settings').update({enabled:true,health_status:'healthy',checked_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('provider','sendbyte');
  if(enableError)throw Error('Sender saved, but SendByte could not be enabled.');
  await service.from('audit_logs').insert({organization_id:org,actor_id:user.id,action:'sender.sendbyte_verified',entity_type:'sending_domain',entity_id:domainId,details:{domain,from_email:email}});
  revalidatePath('/admin/providers');revalidatePath('/dashboard/communications/new');
  return {success:'SendByte sender connected and verified.'};
 }catch(e){return {error:e instanceof Error?e.message:'SendByte sender could not be connected.'};}
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
