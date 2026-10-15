/** Resend MARKETING Broadcast API. Does not use transactional /emails. */
import {mailbox,senderName} from './validation.ts';

const BASE='https://api.resend.com';
export class ResendRequestError extends Error {
 readonly uncertain:boolean;
 constructor(message:string,uncertain=false){super(message);this.name='ResendRequestError';this.uncertain=uncertain;}
}
export function broadcastClient(apiKey:string,transport:typeof fetch=fetch){
 if(!apiKey.startsWith('re_')||apiKey.length<12)throw Error('RESEND_API_KEY is missing or invalid.');
 async function request(path:string,method:'GET'|'POST',body?:object,allowMissing=false):Promise<Record<string,unknown>|null>{
  let response:Response;
  try{response=await transport(BASE+path,{method,headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(15000),...(body?{body:JSON.stringify(body)}:{})});}
  catch{throw new ResendRequestError('Resend response could not be confirmed. Check the provider dashboard before retrying.',true);}
  if(allowMissing&&response.status===404)return null;
  if(!response.ok)throw new ResendRequestError(`Resend rejected the request (HTTP ${response.status}). Check API permissions and account limits.`);
  if(response.status===204)return {};
  const value:unknown=await response.json().catch(()=>null);
  if(!value||typeof value!=='object'||Array.isArray(value))throw new ResendRequestError('Resend returned an unexpected response. Review its dashboard.',true);
  return value as Record<string,unknown>;
 }
 function idFrom(result:Record<string,unknown>|null,label:string){
  const id=result?.id;
  if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))throw new ResendRequestError(`Resend ${label} confirmation is uncertain. Review its dashboard.`,true);
  return id;
 }
 return {
  async segment(name:string){return idFrom(await request('/segments','POST',{name:name.slice(0,100)}),'segment');},
  /** Respect Resend's global unsubscribe state. NEVER resubscribe an existing contact. */
  async addEligibleContact(email:string,firstName:string,lastName:string,segmentId:string):Promise<boolean>{
   const valid=mailbox(email);
   const known=await request(`/contacts/${encodeURIComponent(valid)}`,'GET',undefined,true);
   if(known?.unsubscribed===true)return false;
   if(!known){
    await request('/contacts','POST',{email:valid,first_name:firstName.slice(0,100),last_name:lastName.slice(0,100)});
   }
   await request(`/contacts/${encodeURIComponent(valid)}/segments/${encodeURIComponent(segmentId)}`,'POST');
   return true;
  },
  async draft({segmentId,from,name,subject,html}:{segmentId:string;from:string;name:string;subject:string;html:string}){
   const s=subject.trim();if(!s||s.length>200||/[\r\n]/.test(s))throw Error('Invalid broadcast subject');
   if(!html.includes('{{{RESEND_UNSUBSCRIBE_URL}}}'))throw Error('Resend unsubscribe placeholder is required');
   return idFrom(await request('/broadcasts','POST',{segment_id:segmentId,from:`${senderName(name)} <${mailbox(from)}>`,subject:s,html,send:false}),'broadcast');
  },
  async send(id:string,scheduledAt?:string){
   const result=await request(`/broadcasts/${encodeURIComponent(id)}/send`,'POST',scheduledAt?{scheduled_at:scheduledAt}:{});
   if(!result)throw new ResendRequestError('Broadcast submission was not confirmed.',true);
   return result;
  }
 };
}
