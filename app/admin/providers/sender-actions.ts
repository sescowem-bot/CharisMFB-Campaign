'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {supabaseServer} from '@/lib/supabase/server';
import {emailServiceDb} from '@/lib/email/server';
import {providerAdapter} from '@/lib/email/providers';
import {domainName,mailbox,senderName,type Provider} from '@/lib/email/validation';

type State={error?:string;success?:string};
const providers=z.enum(['sendbyte','resend','brevo']);
async function access(){
 const org=z.string().uuid().parse(process.env.SINGLE_COMPANY_ORG_ID);
 const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();
 if(!user?.email_confirmed_at)throw new Error('Sign in with a verified email.');
 const {data:allowed,error}=await db.rpc('can_manage_senders',{p_org:org});
 if(error||allowed!==true)throw new Error('Authorised sender administrator access is required.');
 return {org,user};
}
const apiKey=(provider:Provider)=>process.env[provider==='sendbyte'?'SENDBYTE_API_KEY':provider==='resend'?'RESEND_API_KEY':'BREVO_API_KEY']||'';

/** Add or edit an address only after the selected provider confirms its domain. */
export async function saveSenderIdentity(_:State,form:FormData):Promise<State>{
 try{
  const {org,user}=await access();
  const provider=providers.parse(form.get('provider')) as Provider;
  const id=form.get('sender_id')?z.string().uuid().parse(form.get('sender_id')):null;
  const name=senderName(String(form.get('from_name')||''));
  const email=mailbox(String(form.get('from_email')||''));
  const reply=mailbox(String(form.get('reply_to')||'').trim()||email);
  const domain=domainName(email.split('@')[1]);
  const key=apiKey(provider);if(!key)throw new Error('This provider API key is not configured in the server environment.');
  const adapter=providerAdapter(provider,key);
  const verified=await adapter.findVerifiedDomain(domain);
  if(!verified.verified)throw new Error('The provider has not verified this sending domain.');
  if(provider==='brevo')await adapter.findVerifiedBrevoSender(email);
  const service=emailServiceDb();
  const {data:existingDomain,error:domainRead}=await service.from('sending_domains')
   .select('id,verification_status').eq('organization_id',org).eq('provider',provider).eq('domain',domain).maybeSingle();
  if(domainRead)throw new Error('Could not read the saved sending domain.');
  if(existingDomain?.verification_status==='revoked')throw new Error('This domain was revoked. Ask an administrator to review it before reconnecting.');
  let domainId=existingDomain?.id;
  const domainValues={provider,provider_domain_id:verified.id,verification_status:'verified',charis_connected:true,
   dns_records:verified.records,ownership_method:'provider_account',last_checked_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  if(domainId){
   const {error}=await service.from('sending_domains').update(domainValues).eq('organization_id',org).eq('id',domainId);
   if(error)throw new Error('Could not update the verified domain.');
  }else{
   const {data,error}=await service.from('sending_domains').insert({...domainValues,organization_id:org,domain,created_by:user.id}).select('id').single();
   if(error||!data)throw new Error('Could not save the verified domain.');
   domainId=data.id;
  }
  if(id){
   const {data:current,error:currentError}=await service.from('sender_identities').select('id,domain_id').eq('organization_id',org).eq('id',id).maybeSingle();
   if(currentError||!current)throw new Error('Sender address not found in this workspace.');
   const {data:oldDomain,error:oldDomainError}=await service.from('sending_domains').select('provider').eq('organization_id',org).eq('id',current.domain_id).maybeSingle();
   if(oldDomainError||oldDomain?.provider!==provider)throw new Error('Change a sender using its existing provider. To switch providers, add a new sender first.');
   const {error}=await service.from('sender_identities').update({domain_id:domainId,from_name:name,from_email:email,reply_to:reply,is_active:true}).eq('organization_id',org).eq('id',id);
   if(error)throw new Error('Could not update this sender address.');
  }else{
   const values={organization_id:org,domain_id:domainId,from_name:name,from_email:email,reply_to:reply,is_active:true};
   const saved=await service.from('sender_identities').upsert(values,{onConflict:'organization_id,domain_id,from_email'});
   if(saved.error&&saved.error.code==='42P10'){
    const legacy=await service.from('sender_identities').upsert(values,{onConflict:'organization_id,from_email'});
    if(legacy.error)throw new Error('Could not save the sender address.');
   }else if(saved.error)throw new Error('Could not save the sender address.');
  }
  const {data:identity,error:identityRead}=await service.from('sender_identities').select('id').eq('organization_id',org).eq('domain_id',domainId).eq('from_email',email).single();
  if(identityRead||!identity)throw new Error('Sender saved but could not be confirmed.');
  const {error:audit}=await service.from('audit_logs').insert({organization_id:org,actor_id:user.id,action:id?'sender.identity_updated':'sender.identity_added',entity_type:'sender_identity',entity_id:identity.id,details:{provider,domain,from_email:email}});
  if(audit)throw new Error('Sender saved but audit logging failed. Check the audit history before sending.');
  revalidatePath('/admin/providers');revalidatePath('/dashboard/senders');revalidatePath('/dashboard/communications/new');
  return {success:'Sender address verified and saved. Select it in the provider delivery settings when ready.'};
 }catch(e){return {error:e instanceof Error?e.message:'Sender address could not be saved.'};}
}

export async function disableSenderIdentity(_:State,form:FormData):Promise<State>{
 try{
  const {org,user}=await access();const id=z.string().uuid().parse(form.get('sender_id'));
  const service=emailServiceDb();
  const {data,error}=await service.from('sender_identities').update({is_active:false}).eq('organization_id',org).eq('id',id).select('from_email').maybeSingle();
  if(error||!data)throw new Error('Sender address was not found.');
  const {error:audit}=await service.from('audit_logs').insert({organization_id:org,actor_id:user.id,action:'sender.identity_disabled',entity_type:'sender_identity',entity_id:id,details:{from_email:data.from_email}});
  if(audit)throw new Error('Sender disabled but audit logging failed.');
  revalidatePath('/admin/providers');revalidatePath('/dashboard/senders');return {success:'Sender disabled. It will no longer be offered for new campaigns.'};
 }catch(e){return {error:e instanceof Error?e.message:'Sender could not be disabled.'};}
}

export async function deleteSenderIdentity(_:State,form:FormData):Promise<State>{
 try{
  const {org,user}=await access();const id=z.string().uuid().parse(form.get('sender_id'));const service=emailServiceDb();
  const {data:sender,error:read}=await service.from('sender_identities').select('from_email,is_active').eq('organization_id',org).eq('id',id).maybeSingle();
  if(read||!sender)throw new Error('Sender address was not found.');
  if(sender.is_active)throw new Error('Disable this sender before deleting it.');
  const checks=await Promise.all([
   service.from('campaign_drafts').select('id',{head:true,count:'exact'}).eq('organization_id',org).eq('sender_id',id),
   service.from('email_test_attempts').select('id',{head:true,count:'exact'}).eq('organization_id',org).eq('sender_id',id),
   service.from('email_deliveries').select('id',{head:true,count:'exact'}).eq('organization_id',org).eq('route_sender_id',id)
  ]);
  if(checks.some(x=>x.error))throw new Error('Could not confirm whether this sender has delivery history.');
  if(checks.some(x=>(x.count||0)>0))throw new Error('This sender has delivery or test history. It remains disabled for audit integrity.');
  await service.from('charis_direct_provider_prefs').delete().eq('organization_id',org).eq('sender_id',id);
  await service.from('charis_email_routes').delete().eq('organization_id',org).eq('sender_id',id);
  const {error}=await service.from('sender_identities').delete().eq('organization_id',org).eq('id',id);
  if(error)throw new Error('Could not delete this sender. Check whether another record still references it.');
  const {error:audit}=await service.from('audit_logs').insert({organization_id:org,actor_id:user.id,action:'sender.identity_deleted',entity_type:'sender_identity',entity_id:id,details:{from_email:sender.from_email}});
  if(audit)throw new Error('Sender deleted but audit logging failed.');
  revalidatePath('/admin/providers');revalidatePath('/dashboard/senders');return {success:'Sender address deleted.'};
 }catch(e){return {error:e instanceof Error?e.message:'Sender address could not be deleted.'};}
}
