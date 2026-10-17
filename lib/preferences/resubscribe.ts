import 'server-only';
import {randomBytes} from 'node:crypto';
import {emailServiceDb,providerFor} from '@/lib/email/server';
import {mailbox} from '@/lib/email/validation';
import type {Provider} from '@/lib/email/validation';
import {sendQueuedEmail} from '@/lib/delivery/transport';
import {preferenceOrigin,tokenHash} from '@/lib/preferences/tokens';

const bankOrg=()=>process.env.SINGLE_COMPANY_ORG_ID||'';
const cleanEmail=(raw:string)=>raw.trim().toLowerCase();
const isEmail=(value:string)=>value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** No customer changes are made until the mailbox owner confirms the verification link. */
export async function requestResubscription(raw:string,source:'customer'|'staff',actor?:string){
 const email=cleanEmail(raw),org=bankOrg();
 if(!org||!isEmail(email))return {accepted:false as const,reason:'invalid'};
 const token=randomBytes(32).toString('base64url'),hash=tokenHash(token);
 if(!hash)return {accepted:false as const,reason:'invalid'};
 const db=emailServiceDb();
 const {data:id,error}=await db.rpc('charis_subscription_issue',{p_org:org,p_email:email,p_hash:hash,p_source:source,p_actor:source==='staff'?actor||null:null});
 if(error)throw Error('Subscription requests are unavailable. Confirm SQL 051.');
 if(!id)return {accepted:false as const,reason:'not_issued'};
 const verification=new URL('/subscribe/confirm',preferenceOrigin());verification.searchParams.set('token',token);
 const {data:prefs,error:preferencesError}=await db.from('charis_direct_provider_prefs').select('provider,sender_id,priority')
 .eq('organization_id',org).eq('enabled',true).order('priority',{ascending:true}).limit(3);
 if(preferencesError||!prefs?.length)return {accepted:false as const,reason:'no_provider'};
 let outcome:'accepted'|'failed'|'uncertain'='failed';
 // Deliberately choose a SINGLE provider per verification request, with no uncertain retries.
 for(const pref of prefs){
  const provider=pref.provider as Provider;
  if(!['resend','brevo','mailjet'].includes(provider))continue;
  const {data:sender}=await db.from('sender_identities').select('domain_id,from_name,from_email,reply_to,is_active')
   .eq('organization_id',org).eq('id',pref.sender_id).maybeSingle();
  if(!sender?.is_active)continue;
  const {data:domain}=await db.from('sending_domains').select('provider,verification_status,charis_connected,domain')
   .eq('organization_id',org).eq('id',sender.domain_id).maybeSingle();
  if(!domain?.charis_connected||domain.verification_status!=='verified'||domain.provider!==provider)continue;
  const key=process.env[provider==='resend'?'RESEND_API_KEY':provider==='brevo'?'BREVO_API_KEY':'MAILJET_API_KEY'];
  if(!key)continue;
  try{
   await providerFor(provider);
   const result=await sendQueuedEmail({provider,key,mailjetSecret:process.env.MAILJET_SECRET_KEY,
    id,name:sender.from_name,from:sender.from_email,replyTo:sender.reply_to||sender.from_email,
    domain:mailbox(sender.from_email).split('@')[1],to:email,
    subject:'Confirm your Charis email subscription',
    html:`<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f7f5fc;padding:24px"><main style="background:#fff;max-width:520px;margin:auto;padding:28px;border-radius:14px"><h2 style="color:#40239a">Charis Microfinance Bank</h2><h3>Confirm your email preferences</h3><p>Someone requested to receive optional Charis updates again for this email address. Select Confirm only if it was you.</p><p><a href="${verification.href}" style="display:inline-block;background:#40239a;color:#fff;padding:13px 20px;text-decoration:none;border-radius:8px">Review and confirm</a></p><p style="color:#64748b;font-size:13px">This link expires after 30 minutes. Ignore this message if you did not request it. You will remain unsubscribed.</p></main></body></html>`});
   outcome=result.status==='accepted'?'accepted':result.status==='unknown'?'uncertain':'failed';
  }catch{outcome='uncertain';}
  // Even after a definitive failure, avoid second-provider unsolicited verification spam.
  break;
 }
 await db.from('charis_resubscribe_requests').update({delivery_state:outcome}).eq('id',id).eq('organization_id',org);
 return {accepted:outcome==='accepted',reason:outcome};
}

export async function inspectResubscribeToken(token:string){
 const hash=tokenHash(token);if(!hash)return false;
 const {data}=await emailServiceDb().from('charis_resubscribe_requests').select('expires_at,verified_at')
 .eq('token_hash',hash).maybeSingle();
 return !!data && (!!data.verified_at || new Date(data.expires_at).getTime()>Date.now());
}

export async function confirmResubscription(token:string){
 const hash=tokenHash(token);if(!hash)return 'invalid';
 const {data,error}=await emailServiceDb().rpc('charis_subscription_confirm',{p_hash:hash});
 if(error||!['done','invalid','blocked','expired'].includes(data))return 'unavailable';
 return data as 'done'|'invalid'|'blocked'|'expired';
}
