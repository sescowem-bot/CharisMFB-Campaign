'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {senderAccess,emailServiceDb} from '@/lib/email/server';
import {providerAdapter} from '@/lib/email/providers';
import {listVerifiedResendDomains} from '@/lib/email/charis-resend';
import {domainName,mailbox,senderName} from '@/lib/email/validation';

export type CharisConnectResult={success?:string;error?:string};
const uuid=z.string().uuid();
function checkCharis(org:string){
 if(process.env.SINGLE_COMPANY_MODE!=='true'||org!==process.env.SINGLE_COMPANY_ORG_ID)
  throw new Error('Sender settings are only available to the configured Charis workspace.');
}
/** No sender email/name stored in Vercel. Admin chooses a mailbox on a currently verified Resend domain. */
export async function connectCharisResend(_:CharisConnectResult,form:FormData):Promise<CharisConnectResult>{
 try{
  const org=uuid.parse(form.get('organization_id'));checkCharis(org);
  const {user}=await senderAccess(org);
  const name=senderName(String(form.get('from_name')||''));
  const domain=domainName(String(form.get('from_domain')||''));
  const local=String(form.get('from_local')||'').trim().toLowerCase();
  const from=mailbox(`${local}@${domain}`);
  if(from.split('@')[1]!==domain)throw new Error('Sender must use the selected verified domain.');
  const reply=mailbox(String(form.get('reply_to')||'').trim()||from);
  const domains=await listVerifiedResendDomains();
  const match=domains.find(d=>d.domain===domain);
  if(!match)throw new Error('That sending domain is not verified and enabled in the configured Resend account. Verify it once before selecting it.');
  // Always recheck directly with Resend at save time, not only from the domain list.
  const apiKey=process.env.RESEND_API_KEY!;
  const status=await providerAdapter('resend',apiKey).check(domain,match.providerId);
  if(!status.verified)throw new Error('Resend has not confirmed that this domain is verified for sending.');
  const service=emailServiceDb();
  const {data:existing,error:findErr}=await service.from('sending_domains').select('id,verification_status,provider').eq('organization_id',org).eq('domain',domain).maybeSingle();
  if(findErr)throw new Error('Cannot read the Charis sender configuration.');
  if(existing?.verification_status==='revoked')throw new Error('This domain has been revoked in Charis. Ask an administrator to review the revocation.');
  if(existing&&existing.provider!=='resend')throw new Error('This domain is already configured with another provider.');
  const values={provider:'resend',provider_domain_id:status.id,verification_status:'verified',dns_records:status.records,ownership_method:'provider_account',last_checked_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  let domainId=existing?.id;
  if(domainId){
   const {error}=await service.from('sending_domains').update(values).eq('id',domainId).eq('organization_id',org);
   if(error)throw new Error('Could not refresh the verified Resend domain.');
  } else {
   const {data,error}=await service.from('sending_domains').insert({...values,organization_id:org,domain,created_by:user.id}).select('id').single();
   if(error||!data)throw new Error(`Cannot save the sender domain: ${error?.message||'Database response missing'}`);
   domainId=data.id;
  }
  const {error:senderError}=await service.from('sender_identities').upsert({organization_id:org,domain_id:domainId,from_name:name,from_email:from,reply_to:reply,is_active:true},{onConflict:'organization_id,from_email'});
  if(senderError)throw new Error(`Could not save the sender identity: ${senderError.message}`);
  const {error:providerError}=await service.from('email_provider_settings').update({enabled:true,health_status:'healthy',checked_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('provider','resend');
  if(providerError)throw new Error('Sender saved, but Resend could not be enabled for the workspace.');
  const {error:auditError}=await service.from('audit_logs').insert({organization_id:org,actor_id:user.id,action:'charis.sender.saved',entity_type:'sending_domain',entity_id:domainId,details:{provider:'resend',domain,from_email:from}});
  if(auditError)throw new Error('Sender saved, but audit logging failed. Check the admin audit log before sending.');
  revalidatePath('/dashboard/senders');revalidatePath('/dashboard/campaigns');
  return {success:`Sender saved: ${name} <${from}>. You can select it when creating campaigns and send a test to your verified account.`};
 }catch(e){return {error:e instanceof Error?e.message:'Unable to save the sender.'};}
}

/** A disabled identity cannot be used for newly queued messages. Preserves campaign history. */
export async function disableCharisSender(_:CharisConnectResult,form:FormData):Promise<CharisConnectResult>{
 try{
  const org=uuid.parse(form.get('organization_id'));checkCharis(org);
  const id=uuid.parse(form.get('sender_id'));
  const {user}=await senderAccess(org);
  const service=emailServiceDb();
  const {data,error}=await service.from('sender_identities').update({is_active:false}).eq('organization_id',org).eq('id',id).select('from_email').maybeSingle();
  if(error||!data)throw new Error('Sender was not found or could not be disabled.');
  const {error:auditError}=await service.from('audit_logs').insert({organization_id:org,actor_id:user.id,action:'charis.sender.disabled',entity_type:'sender_identity',entity_id:id,details:{from_email:data.from_email}});
  if(auditError)throw new Error('Sender disabled, but audit logging failed.');
  revalidatePath('/dashboard/senders');revalidatePath('/dashboard/campaigns');
  return {success:`Sender ${data.from_email} disabled. Existing campaign records were kept.`};
 }catch(e){return {error:e instanceof Error?e.message:'Unable to disable sender.'};}
}
