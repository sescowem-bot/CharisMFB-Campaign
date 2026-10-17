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
/** Old links still work; 051 stores the latest preference in a single ordered sync queue. */
export {syncPendingSubscriptionChanges} from './sync';
import {syncPendingSubscriptionChanges} from './sync';
export async function retryPendingResendOptouts(limit=5){
 return syncPendingSubscriptionChanges(limit);
}
export async function applyPreferenceOptout(token:string){
 const hash=tokenHash(token);if(!hash)return 'invalid';
 const db=emailServiceDb();
 const {data,error}=await db.rpc('charis_customer_email_optout',{p_token_hash:hash});
 if(error||!['done','expired','invalid'].includes(data))return 'unavailable';
 if(data==='done'){
  const {data:link}=await db.from('charis_email_preference_tokens').select('organization_id,email').eq('token_hash',hash).maybeSingle();
  if(link)await syncPendingSubscriptionChanges(1,{org:link.organization_id,email:link.email}).catch(()=>{});
 }
 return data as 'done'|'expired'|'invalid';
}
