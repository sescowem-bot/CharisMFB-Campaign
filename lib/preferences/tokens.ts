import 'server-only';
import {createHash,randomBytes} from 'node:crypto';
import {emailServiceDb} from '@/lib/email/server';

const TOKEN_RE=/^[A-Za-z0-9_-]{43}$/;
export function tokenHash(token:string){
 if(!TOKEN_RE.test(token))return null;
 return createHash('sha256').update(token).digest('hex');
}
export function preferenceOrigin(){
 const raw=process.env.CHARIS_PUBLIC_PREFERENCES_ORIGIN||process.env.NEXT_PUBLIC_APP_URL||'';
 const url=new URL(raw);
 if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash||url.username||url.password)
  throw new Error('Configure the public preference origin as a bare HTTPS domain');
 return url;
}
export async function reservePreferenceLink(input:{org:string;contact:string;email:string}){
 const token=randomBytes(32).toString('base64url');
 const hash=tokenHash(token);
 if(!hash)throw Error('Unable to create preference link');
 const {error}=await emailServiceDb().from('charis_email_preference_tokens').insert({
  token_hash:hash,organization_id:input.org,contact_id:input.contact,email:input.email.toLowerCase(),
  expires_at:new Date(Date.now()+180*86400_000).toISOString()
 });
 if(error)throw new Error('Cannot reserve preference link; install SQL 050 first');
 const url=new URL('/unsubscribe',preferenceOrigin());url.searchParams.set('token',token);
 return url.href;
}
export async function validPreferenceToken(token:string){
 const hash=tokenHash(token);if(!hash)return false;
 const {data,error}=await emailServiceDb().from('charis_email_preference_tokens')
  .select('token_hash,expires_at,used_at').eq('token_hash',hash).maybeSingle();
 if(error||!data)return false;
 return Boolean(data.used_at || new Date(data.expires_at).getTime()>Date.now());
}
async function syncResendOptout(hash:string){
 const key=process.env.RESEND_API_KEY;
 if(!key)return;
 const db=emailServiceDb();
 const {data:link}=await db.from('charis_email_preference_tokens').select('email,resend_sync_status,used_at').eq('token_hash',hash).maybeSingle();
 if(!link?.used_at || ['synced','not_found'].includes(link.resend_sync_status))return;
 try{
  const res=await fetch('https://api.resend.com/contacts/'+encodeURIComponent(link.email),{
   method:'PATCH',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
   body:JSON.stringify({unsubscribed:true}),cache:'no-store',signal:AbortSignal.timeout(9000)
  });
  const state=res.ok?'synced':res.status===404?'not_found':'error';
  await db.from('charis_email_preference_tokens').update({resend_sync_status:state,...(res.ok?{resend_synced_at:new Date().toISOString()}:{})}).eq('token_hash',hash);
 }catch{
  await db.from('charis_email_preference_tokens').update({resend_sync_status:'error'}).eq('token_hash',hash);
 }
}
/** Scheduled retry of Resend contact synchronisation after local bank suppression.
 * Provider outages never roll back the customer's completed opt-out.
 */
export async function retryPendingResendOptouts(limit=5){
 if(!process.env.RESEND_API_KEY)return {attempted:0};
 const {data,error}=await emailServiceDb().from('charis_email_preference_tokens')
  .select('token_hash').not('used_at','is',null).in('resend_sync_status',['pending','error'])
  .order('created_at',{ascending:true}).limit(Math.min(10,Math.max(1,limit)));
 if(error||!data)return {attempted:0};
 for(const link of data)await syncResendOptout(link.token_hash);
 return {attempted:data.length};
}
export async function applyPreferenceOptout(token:string){
 const hash=tokenHash(token);if(!hash)return 'invalid';
 const {data,error}=await emailServiceDb().rpc('charis_customer_email_optout',{p_token_hash:hash});
 if(error||!['done','expired','invalid'].includes(data))return 'unavailable';
 if(data==='done')await syncResendOptout(hash).catch(()=>{});
 return data as 'done'|'expired'|'invalid';
}
