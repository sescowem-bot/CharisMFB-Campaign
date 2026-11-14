import type {Provider} from './validation.ts';
import {domainName,mailbox,senderName,matchesDomain} from './validation.ts';
export type DnsRecord={type:string;name:string;value:string;status:string;priority?:number};
export type DomainState={id:string;domain:string;verified:boolean;records:DnsRecord[]};
type Json=Record<string,unknown>;
const obj=(v:unknown):Json=>v&&typeof v==='object'&&!Array.isArray(v)?v as Json:{};
export function normalizeDomain(provider:Provider,raw:unknown,expected:string,id?:string):DomainState{
 const outer=obj(raw),data=obj(outer.data??raw),domain=domainName(String(data.name??data.domain??data.domain_name??''));
 if(domain!==domainName(expected))throw new Error('Provider returned a different domain.');
 const providerId=String(data.id??id??'');if(!providerId||providerId.length>200)throw new Error('Provider domain identifier missing.');
 const records:DnsRecord[]=[];
 if(provider==='resend'){
  for(const item of Array.isArray(data.records)?data.records:[]){const r=obj(item);records.push({type:String(r.type??''),name:String(r.name??''),value:String(r.value??''),status:String(r.status??'pending'),...(typeof r.priority==='number'?{priority:r.priority}:{})});}
 }else if(provider==='brevo'){
  for(const r of Object.values(obj(data.dns_records)).map(obj))records.push({type:String(r.type??''),name:String(r.host_name??''),value:String(r.value??''),status:r.status===true?'verified':'pending'});
 }else{
  for(const item of Array.isArray(data.dns_records)?data.dns_records:[]){const r=obj(item);records.push({type:String(r.type??''),name:String(r.host??r.name??''),value:String(r.value??''),status:'pending'});}
 }
 const verified=provider==='resend'?data.status==='verified'&&obj(data.capabilities).sending==='enabled'
  :provider==='brevo'?data.verified===true&&data.authenticated===true
  :data.status==='verified'&&data.deliverability_ready===true;
 return {id:providerId,domain,records,verified};
}
export function providerAdapter(provider:Provider,key:string,transport:typeof fetch=fetch){
 if(!key)throw new Error('Provider credentials are not configured.');
 const base=provider==='sendbyte'?'https://api.sendbyte.africa':provider==='resend'?'https://api.resend.com':'https://api.brevo.com/v3';
 async function request(path:string,method='GET',body?:unknown):Promise<Json>{
  const headers:Record<string,string>={'Content-Type':'application/json'};
  if(provider==='brevo')headers['api-key']=key;else headers.Authorization=`Bearer ${key}`;
  let response:Response;
  try{response=await transport(base+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',signal:AbortSignal.timeout(20000)});}
  catch{throw new Error('Provider connection failed. Check its status before retrying.');}
  if(!response.ok)throw new Error(response.status===429?'Provider rate limit reached. Try again later.':`Provider request failed (${response.status}). Check the provider account.`);
  return obj(await response.json().catch(()=>({})));
 }
 const domainPath=(domain:string,id:string)=>provider==='sendbyte'?'/v1/domains/'+encodeURIComponent(id):provider==='resend'?'/domains/'+encodeURIComponent(id):'/senders/domains/'+encodeURIComponent(domainName(domain));
 return {
  async findVerifiedSendByteDomain(domain:string){
   if(provider!=='sendbyte')throw new Error('Only SendByte supports this domain lookup.');
   const expected=domainName(domain),result=await request('/v1/domains'),rows=Array.isArray(result.data)?result.data:[];
   const found=rows.map(obj).find(item=>String(item.domain||'').toLowerCase()===expected);
   if(!found||!found.id)throw new Error('Add this sending domain to SendByte first.');
   const state=normalizeDomain('sendbyte',found,expected,String(found.id));
   if(!state.verified)throw new Error('Complete domain authentication in SendByte before connecting it to Charis.');
   return state;
  },
  async findVerifiedBrevoSender(email:string){
   if(provider!=='brevo')throw new Error('This check is only available for Brevo.');
   const value=mailbox(email),list=await request('/senders'),rows=Array.isArray(list.senders)?list.senders:[];
   const sender=rows.map(obj).find(x=>String(x.email||'').toLowerCase()===value&&x.active===true);
   if(!sender)throw new Error('This address is not an active Brevo sender.');
   const domain=value.split('@')[1],state=normalizeDomain('brevo',await request('/senders/domains/'+encodeURIComponent(domain)),domain,domain);
   if(!state.verified)throw new Error('Brevo domain authentication is incomplete.');
   return {email:value,domain,id:state.id};
  },
  async create(domain:string){
   const name=domainName(domain);
   const data=provider==='sendbyte'?await request('/v1/domains','POST',{domain:name}):provider==='resend'?await request('/domains','POST',{name}):await request('/senders/domains','POST',{name});
   return normalizeDomain(provider,data,name);
  },
  async check(domain:string,id:string,trigger=false){
   if(!id)throw new Error('Provider domain registration needs administrator review.');
   if(trigger)await request(domainPath(domain,id)+(provider==='sendbyte'?'/verify':provider==='resend'?'/verify':'/authenticate'),provider==='brevo'?'PUT':'POST');
   return normalizeDomain(provider,await request(domainPath(domain,id)),domain,id);
  },
  async health(){await request(provider==='sendbyte'?'/v1/domains':provider==='resend'?'/domains?limit=1':'/account');},
  async registerSender(name:string,email:string){
   if(provider==='brevo')await request('/senders','POST',{name:senderName(name),email:mailbox(email)});
  },
  async sendTest(input:{name:string;email:string;replyTo:string;to:string;domain:string;html:string;attempt:string;subject?:string}){
   if(!matchesDomain(input.email,input.domain))throw new Error('Sender address must match the verified domain.');
   const name=senderName(input.name),email=mailbox(input.email),to=mailbox(input.to),replyTo=mailbox(input.replyTo);
   const subject=input.subject??'Charis sender test';
   if(!subject.trim()||subject.length>207||/[\r\n]/.test(subject))throw new Error('Invalid test email subject.');
   const body=provider==='sendbyte'?{from:`${name} <${email}>`,to:[to],reply_to:replyTo,subject,html:input.html}
    :provider==='resend'?{from:`${name} <${email}>`,to:[to],reply_to:replyTo,subject,html:input.html,headers:{'X-Charis-Test-ID':input.attempt}}
    :{sender:{name,email},to:[{email:to}],replyTo:{email:replyTo},subject,htmlContent:input.html,headers:{'X-Charis-Test-ID':input.attempt}};
   const result=await request(provider==='sendbyte'?'/v1/emails':provider==='resend'?'/emails':'/smtp/email','POST',body),payload=obj(result.data??result),id=String(payload.id??payload.messageId??'');
   if(!id)throw new Error('Provider acknowledgement missing. Check its dashboard before retrying.');
   return id;
  }
 };
}
