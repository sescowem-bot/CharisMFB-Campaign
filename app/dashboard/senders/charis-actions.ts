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
  if(!match)throw new Error('Resend has not verified this domain for sending. Complete verification and try again.');
  // Always recheck directly with Resend at save time, not only from the domain list.
  const apiKey=process.env.RESEND_API_KEY!;
  const status=await providerAdapter('resend',apiKey).check(domain,match.providerId);
  if(!status.verified)throw new Error('Resend has not confirmed that this domain is verified for sending.');
  const service=emailServiceDb();
  const {data:existing,error:findErr}=await service.from('sending_domains').select('id,verification_status,provider,charis_connected').eq('organization_id',org).eq('domain',domain).maybeSingle();
  if(findErr)throw new Error('Cannot read the Charis sender configuration.');
  if(!existing?.charis_connected)throw new Error('This domain is not authorised for Charis. Use Connect Domain above first.');
  if(existing.verification_status==='revoked')throw new Error('This domain has been revoked in Charis. Ask an administrator to review the revocation.');
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

/** One-time account/domain association; no provider IDs, TXT tokens or API keys in the browser. */
export async function setupCharisResendDomain(_:CharisConnectResult,form:FormData):Promise<CharisConnectResult>{
 try{
  const org=uuid.parse(form.get('organization_id'));checkCharis(org);
  const {user}=await senderAccess(org);
  const domain=domainName(String(form.get('domain')||''));
  const service=emailServiceDb();
  const {data:existing,error:read}=await service.from('sending_domains').select('id,provider,verification_status').eq('organization_id',org).eq('domain',domain).maybeSingle();
  if(read)throw new Error('Could not read sender domains.');
  if(existing?.verification_status==='revoked')throw new Error('This domain was revoked. It must be reviewed before being reconnected.');
  if(existing&&existing.provider!=='resend')throw new Error('Domain is already linked to another provider.');
  const {findResendDomain}=await import('@/lib/email/charis-domain-setup');
  const known=await findResendDomain(domain);
  const provider=providerAdapter('resend',process.env.RESEND_API_KEY||'');
  const state=known?await provider.check(domain,known.id):await provider.create(domain);
  const values={provider:'resend',provider_domain_id:state.id,verification_status:state.verified?'verified':'pending',charis_connected:true,dns_records:state.records,ownership_method:'provider_account',last_checked_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  let id=existing?.id;
  if(id){const {error}=await service.from('sending_domains').update(values).eq('organization_id',org).eq('id',id);if(error)throw new Error('Failed to update Charis domain: '+error.message);}
  else {const {data,error}=await service.from('sending_domains').insert({...values,organization_id:org,domain,created_by:user.id}).select('id').single();if(error||!data)throw new Error('Unable to record new domain: '+(error?.message||'Unknown error'));id=data.id;}
  const {error:audit}=await service.from('audit_logs').insert({organization_id:org,actor_id:user.id,action:'charis.domain.connected',entity_type:'sending_domain',entity_id:id,details:{domain,verified:state.verified}});
  if(audit)throw new Error('Domain saved but audit logging failed.');
  revalidatePath('/dashboard/senders');
  return {success:state.verified?`${domain} is verified and ready. Choose your sender below.`:`${domain} connected. Add the Resend DNS records shown below, then click Check verification. No Domain ID needed.`};
 }catch(e){return {error:e instanceof Error?e.message:'Could not connect domain.'};}
}

export async function checkCharisResendDomain(_:CharisConnectResult,form:FormData):Promise<CharisConnectResult>{
 try{
  const org=uuid.parse(form.get('organization_id'));checkCharis(org);
  const {user}=await senderAccess(org);
  const id=uuid.parse(form.get('domain_id'));
  const service=emailServiceDb();
  const {data:row,error:read}=await service.from('sending_domains').select('domain,provider,provider_domain_id,verification_status').eq('organization_id',org).eq('id',id).maybeSingle();
  if(read||!row||row.provider!=='resend'||row.verification_status==='revoked')throw new Error('Charis sending domain not found.');
  if(!row.provider_domain_id)throw new Error('Resend registration is missing. Use Connect Domain to reconcile automatically.');
  const provider=providerAdapter('resend',process.env.RESEND_API_KEY||'');
  const status=await provider.check(row.domain,row.provider_domain_id,true);
  const {error}=await service.from('sending_domains').update({provider_domain_id:status.id,verification_status:status.verified?'verified':'pending',dns_records:status.records,ownership_method:'provider_account',last_checked_at:new Date().toISOString()}).eq('organization_id',org).eq('id',id);
  if(error)throw new Error('Unable to save verification status.');
  const {error:audit}=await service.from('audit_logs').insert({organization_id:org,actor_id:user.id,action:'charis.domain.checked',entity_type:'sending_domain',entity_id:id,details:{domain:row.domain,verified:status.verified}});
  if(audit)throw new Error('Verification recorded but audit logging failed.');
  revalidatePath('/dashboard/senders');return {success:status.verified?'Resend confirmed this domain is verified for sending.':'Still pending. Check DNS records and try again after propagation.'};
 }catch(e){return {error:e instanceof Error?e.message:'Verification check failed.'};}
}

export async function removePendingCharisDomain(_:CharisConnectResult,form:FormData):Promise<CharisConnectResult>{
 try{
  const org=uuid.parse(form.get('organization_id'));checkCharis(org);
  const {user}=await senderAccess(org);
  const id=uuid.parse(form.get('domain_id'));
  const service=emailServiceDb();
  const {data:row,error}=await service.from('sending_domains').select('domain,verification_status').eq('organization_id',org).eq('id',id).maybeSingle();
  if(error||!row)throw new Error('Domain record was not found.');
  if(row.verification_status==='verified')throw new Error('Verified domains cannot be removed here. Disable their senders first.');
  const {count,error:senders}=await service.from('sender_identities').select('id',{head:true,count:'exact'}).eq('organization_id',org).eq('domain_id',id);
  if(senders||count)throw new Error('Sender records still use this domain. Remove those associations first.');
  const {error:del}=await service.from('sending_domains').delete().eq('organization_id',org).eq('id',id);
  if(del)throw new Error('Unable to remove the unfinished Charis connection.');
  const {error:audit}=await service.from('audit_logs').insert({organization_id:org,actor_id:user.id,action:'charis.domain.unlinked',entity_type:'sending_domain',entity_id:id,details:{domain:row.domain}});
  if(audit)throw new Error('Unlinked but audit logging failed.');
  revalidatePath('/dashboard/senders');return {success:'Unfinished connection removed from Charis. The Resend account itself was not modified.'};
 }catch(e){return {error:e instanceof Error?e.message:'Unable to remove pending connection.'};}
}


/** Permanent sender removal is permitted only for unused, disabled identities. */
export async function removeUnusedCharisSender(_:CharisConnectResult,form:FormData):Promise<CharisConnectResult>{
 try{
  const org=uuid.parse(form.get('organization_id'));checkCharis(org);
  const {user}=await senderAccess(org);
  const id=uuid.parse(form.get('sender_id'));
  const service=emailServiceDb();
  const {data:sender,error}=await service.from('sender_identities').select('from_email,is_active').eq('organization_id',org).eq('id',id).maybeSingle();
  if(error||!sender)throw new Error('Sender not found in this workspace.');
  if(sender.is_active)throw new Error('Disable this sender before removing it.');
  const [{count:campaigns},{count:tests}]=await Promise.all([
   service.from('campaign_drafts').select('id',{head:true,count:'exact'}).eq('organization_id',org).eq('sender_id',id),
   service.from('email_test_attempts').select('id',{head:true,count:'exact'}).eq('organization_id',org).eq('sender_id',id)
  ]);
  if(campaigns||tests)throw new Error('Sender has campaign or test history. It must remain disabled for audit integrity.');
  const {error:removed}=await service.from('sender_identities').delete().eq('organization_id',org).eq('id',id);
  if(removed)throw new Error('Unable to remove sender. It may still be referenced by delivery history.');
  const {error:audit}=await service.from('audit_logs').insert({organization_id:org,actor_id:user.id,action:'charis.sender.removed',entity_type:'sender_identity',entity_id:id,details:{from_email:sender.from_email}});
  if(audit)throw new Error('Sender removed, but audit logging failed.');
  revalidatePath('/dashboard/senders');return {success:'Unused sender removed from Charis.'};
 }catch(e){return {error:e instanceof Error?e.message:'Unable to remove sender.'};}
}
