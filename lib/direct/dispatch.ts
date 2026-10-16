import 'server-only';
import {emailServiceDb,providerFor,refreshDomain} from '@/lib/email/server';
import {escapeHtml,mailbox} from '@/lib/email/validation';
import {sendQueuedEmail} from '@/lib/delivery/transport';
import type {Provider} from '@/lib/email/validation';
import {reservePreferenceLink} from '@/lib/preferences/tokens';

type Item={id:string;organization_id:string;message_id:string;contact_id:string;recipient_email:string|null;recipient_phone:string|null};
type Message={id:string;organization_id:string;subject:string;body:string;channel:'email'|'sms';purpose:string;status:string};
const charisOrg=()=>process.env.SINGLE_COMPANY_ORG_ID||'';
const preparedOrigin=()=>{const origin=new URL(process.env.NEXT_PUBLIC_APP_URL||'');if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.username||origin.password||origin.search||origin.hash)throw Error('Set NEXT_PUBLIC_APP_URL to an HTTPS origin without a path');return origin;};
function smsRecipient(phone:string){const raw=phone.replace(/[^0-9]/g,'');const n=raw.startsWith('0')?'234'+raw.slice(1):raw;if(!/^234[789][0-9]{9}$/.test(n))throw Error('invalid_sms_destination');return n;}
export async function sendDirectSms(text:string,phone:string):Promise<{status:'accepted'|'failed'|'unknown';message?:string;reason:string}> {
 const apiKey=process.env.TERMII_API_KEY||'',sender=process.env.TERMII_SENDER_ID||'';
 if(process.env.CHARIS_CUSTOMER_SMS_ENABLED!=='true'||!apiKey||!/^[A-Za-z0-9 ]{3,11}$/.test(sender))return {status:'failed',reason:'sms_not_configured'};
 const base=process.env.TERMII_API_BASE_URL||'https://api.ng.termii.com';if(!/^https:\/\/[a-z0-9.-]+$/.test(base))return {status:'failed',reason:'invalid_sms_host'};
 const to=smsRecipient(phone);
 let response:Response;
 try{response=await fetch(base+'/api/sms/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to,from:sender,sms:text,type:'plain',channel:'dnd',api_key:apiKey}),signal:AbortSignal.timeout(12000),cache:'no-store'});}catch{return {status:'unknown',reason:'sms_network_uncertain'};}
 if(!response.ok)return {status:response.status>=500||response.status===408?'unknown':'failed',reason:'sms_http_'+response.status};
 const json=await response.json().catch(()=>null);
 if(typeof json?.message_id!=='string'||!json.message_id)return {status:'unknown',reason:'sms_acknowledgement_missing'};
 return {status:'accepted',message:json.message_id,reason:'provider_acknowledged'};
}

/** Claims one recipient atomically. No replay of sending/unknown outcomes. */
export async function sendDirectBatch(limit=3,scope?:{org:string;message:string}){
 const outcomes:Record<string,number>={};let processed=0;
 if(process.env.CHARIS_SIMPLE_SENDING_ENABLED!=='true'||process.env.EMAIL_DELIVERY_ENABLED!=='true')return {processed,outcomes:{disabled:1}};
 preparedOrigin();const db=emailServiceDb(),n=Math.min(Math.max(Math.floor(limit),1),6);
 for(let i=0;i<n;i++){
  const {data:claimed,error:claimError}=await db.rpc('charis_direct_claim',{p_org:scope?.org||null,p_message:scope?.message||null});
  if(claimError)throw Error('Unable to claim communication safely: '+claimError.message);
  if(!claimed){outcomes.idle=(outcomes.idle||0)+1;break;}
  processed++;
  const {data:item,error:itemError}=await db.from('charis_direct_recipients').select('id,organization_id,message_id,contact_id,recipient_email,recipient_phone').eq('id',claimed).single();
  let provider='none',status:'accepted'|'failed'|'unknown'|'skipped'='failed',reason='preparation_failed',providerId:string|null=null;
  try{
   if(itemError||!item)throw Error('claimed_record_unavailable');
   const row=item as Item;
   if(row.organization_id!==charisOrg())throw Error('invalid_organization');
   const [{data:msg,error:msgError},{data:contact,error:contactError},{data:settings}]=await Promise.all([
    db.from('charis_direct_messages').select('id,organization_id,subject,body,channel,purpose,status').eq('id',row.message_id).single(),
    db.from('contacts').select('id,email,phone,archived_at').eq('organization_id',row.organization_id).eq('id',row.contact_id).single(),
    db.from('charis_direct_settings').select('email_enabled,sms_enabled').eq('organization_id',row.organization_id).single()
   ]);
   if(msgError||!msg||contactError||!contact||!settings)throw Error('source_record_missing');
   const m=msg as Message;
   if(!['sending','queued'].includes(m.status))throw Error('message_not_active');
   if(contact.archived_at)throw Error('customer_archived');
   if(m.channel==='email'){
    if(!settings.email_enabled||!row.recipient_email||contact.email?.toLowerCase()!==row.recipient_email.toLowerCase())throw Error('email_destination_changed');
    const {data:suppressed,error:suppError}=await db.from('email_suppressions').select('email,reason').eq('organization_id',row.organization_id).ilike('email',row.recipient_email).limit(1);
    if(suppError)throw Error('suppression_check_unavailable');
    // Respect all recorded opt-outs for manually composed Charis messages.
    // Essential notifications should use a separate tightly authorised event workflow.
    if(suppressed?.length)throw Error('email_suppressed');
    if(m.purpose==='general_notice'){
     const {data:optout,error:optoutError}=await db.from('charis_optional_email_optouts').select('email').eq('organization_id',row.organization_id).eq('email',row.recipient_email.toLowerCase()).maybeSingle();
     if(optoutError)throw Error('preference_check_unavailable');
     if(optout)throw Error('optional_email_opted_out');
    }
    const {data:prefs,error:prefsError}=await db.from('charis_direct_provider_prefs').select('provider,sender_id,priority').eq('organization_id',row.organization_id).eq('enabled',true).order('priority',{ascending:true});
    if(prefsError||!prefs?.length)throw Error('No service-email provider configured. Ask an administrator to select a verified service sender.');
    // One-time, bank-hosted preference URL. No personal data in the URL or token.
    // All manually composed direct emails respect suppressions.
    // Bank-mandated account/security notifications belong to a separate event workflow.
    const preference=await reservePreferenceLink({org:row.organization_id,contact:row.contact_id,email:row.recipient_email});
    const preferenceFooter=`<p style="font-size:12px;color:#64748b"><a href="${escapeHtml(preference)}" style="color:#40239a">${m.purpose==='general_notice'?'Unsubscribe from optional updates':'Manage optional email preferences'}</a></p>`;
    const textBody=escapeHtml(m.body).replace(/\r?\n/g,'<br/>');
    const html=`<!doctype html><html><body style="margin:0;background:#f5f6fa;padding:28px;font-family:Arial,sans-serif"><main style="max-width:640px;margin:auto;background:white;border:1px solid #e4e8f2;padding:28px"><h2 style="color:#41259a;margin-top:0">Charis Microfinance Bank</h2><div style="font-size:15px;line-height:1.7;color:#243047">${textBody}</div><hr style="border:0;border-top:1px solid #e5e7eb;margin-top:30px"><p style="font-size:12px;color:#64748b">This is an official bank service communication. Do not share your PIN, password or OTP by email.</p>${preferenceFooter}</main></body></html>`;
    for(const pref of prefs){
     provider=pref.provider;
     const {data:sender,error:senderError}=await db.from('sender_identities').select('id,domain_id,from_name,from_email,reply_to,is_active').eq('organization_id',row.organization_id).eq('id',pref.sender_id).single();
     if(senderError||!sender?.is_active)continue;
     const {data:domain,error:domainError}=await db.from('sending_domains').select('provider,verification_status,charis_connected,domain').eq('organization_id',row.organization_id).eq('id',sender.domain_id).single();
     if(domainError||domain?.provider!==provider||!domain.charis_connected||domain.verification_status!=='verified')continue;
     try{
      const verified=await refreshDomain(row.organization_id,sender.domain_id);
      if(!verified.verified)continue;
      const key=process.env[provider==='resend'?'RESEND_API_KEY':provider==='brevo'?'BREVO_API_KEY':'MAILJET_API_KEY']||'';
      if(!key)continue;
      await providerFor(provider as Provider);
      const {data:providerLimit}=await db.from('email_provider_settings').select('daily_limit').eq('provider',provider).maybeSingle();
      if(!providerLimit?.daily_limit)continue;
      const day=new Date().toISOString().slice(0,10)+'T00:00:00.000Z';
      const [{count:used},{count:legacyUsed}]=await Promise.all([db.from('charis_direct_recipients').select('id',{head:true,count:'exact'}).eq('provider',provider).in('status',['accepted','failed','unknown']).gte('updated_at',day),db.from('delivery_quota_reservations').select('id',{head:true,count:'exact'}).eq('provider',provider).gte('reserved_at',day)]);
      if((used||0)+(legacyUsed||0)>=providerLimit.daily_limit)continue;
      const result=await sendQueuedEmail({provider:provider as Provider,key,mailjetSecret:process.env.MAILJET_SECRET_KEY,id:row.id,name:sender.from_name,from:sender.from_email,replyTo:sender.reply_to||sender.from_email,domain:mailbox(sender.from_email).split('@')[1],to:row.recipient_email,subject:m.subject,html,unsubscribe:m.purpose==='general_notice'?preference.replace('/unsubscribe?','/api/preferences/unsubscribe?'):undefined});
      status=result.status==='retry'?'failed':result.status;reason=result.reason;providerId=result.message||null;
      if(status==='accepted'||status==='unknown')break;
      // Definitive rejection only; never fail over after a potentially accepted submission.
     }catch(e){
      // Provider preparation can fail before submission. If uncertain, stop safely.
      status='unknown';reason=e instanceof Error?'provider_preparation_or_response_uncertain':'provider_error_uncertain';break;
     }
    }
   }else{
    if(!settings.sms_enabled||!row.recipient_phone||contact.phone!==row.recipient_phone)throw Error('sms_destination_changed');
    provider='termii';const r=await sendDirectSms(m.body,row.recipient_phone);status=r.status;reason=r.reason;providerId=r.message||null;
   }
  }catch(e){reason=e instanceof Error?e.message.slice(0,140):'unknown_preparation_error';status=['email_suppressed','optional_email_opted_out','customer_archived'].includes(reason)?'skipped':'failed';}
  const {error:finished}=await db.rpc('charis_direct_finish',{p_id:claimed,p_status:status,p_provider:provider,p_provider_id:providerId,p_error:reason});
  if(finished)throw Error('Delivery outcome was not saved. Reconcile with the provider before retrying.');
  outcomes[status]=(outcomes[status]||0)+1;
  if(status==='unknown')break;
 }
 return {processed,outcomes};
}
