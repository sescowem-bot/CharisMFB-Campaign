/** SendGrid diagnostics ONLY. This adapter intentionally never delivers customer messages.
 * Marketing broadcasts require consent-aware list synchronisation, Single Sends and event reconciliation.
 */
import {mailbox,domainName,matchesDomain} from './validation.ts';

type AuthDomain={domain?:unknown;valid?:unknown};
const endpoint='https://api.sendgrid.com';
function authorization(key:string){
 if(!/^SG\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/.test(key))throw Error('A valid SendGrid API key is not configured.');
 return {Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
}
async function sendgridRequest(path:string,headers:Record<string,string>,method:'GET'|'POST',body?:object,transport:typeof fetch=fetch){
 let response:Response;
 try{response=await transport(`${endpoint}${path}`,{method,headers,cache:'no-store',signal:AbortSignal.timeout(12000),...(body?{body:JSON.stringify(body)}:{})});}
 catch{throw Error('SendGrid could not be reached. Check the service dashboard before trying again.');}
 if(!response.ok){
  if(response.status===401||response.status===403)throw Error('SendGrid rejected the API key or the key lacks the necessary permissions.');
  if(response.status===429)throw Error('SendGrid API limit reached. Retry later.');
  throw Error(`SendGrid verification failed (HTTP ${response.status}).`);
 }
 return response;
}
/** Only an exact domain match that SendGrid reports valid passes. No DNS changes are made. */
export async function verifySendgridDomain({apiKey,from,transport=fetch}:{apiKey:string;from:string;transport?:typeof fetch}){
 const address=mailbox(from),domain=domainName(address.split('@')[1]);
 const headers=authorization(apiKey);
 const response=await sendgridRequest(`/v3/whitelabel/domains?domain=${encodeURIComponent(domain)}&limit=100`,headers,'GET',undefined,transport);
 const payload:unknown=await response.json().catch(()=>null);
 if(!Array.isArray(payload))throw Error('Unexpected SendGrid domain response.');
 const verified=(payload as AuthDomain[]).some(item=>item&&item.valid===true&&typeof item.domain==='string'&&item.domain.toLowerCase()===domain);
 if(!verified)throw Error('The configured email domain is not authenticated and valid in SendGrid. Verify its DNS records first.');
 return {domain,from:address,verified:true as const};
}
/** SendGrid sandbox mode validates formatting and permissions, but DOES NOT SEND email. */
export async function verifySendgridSandbox({apiKey,from,to,transport=fetch}:{apiKey:string;from:string;to:string;transport?:typeof fetch}){
 const address=mailbox(from),recipient=mailbox(to),key=authorization(apiKey);
 const verified=await verifySendgridDomain({apiKey,from:address,transport});
 if(!matchesDomain(address,verified.domain))throw Error('Sender domain mismatch.');
 const response=await sendgridRequest('/v3/mail/send',key,'POST',{
  personalizations:[{to:[{email:recipient}]}],
  from:{email:address,name:'Charis Microfinance Bank'},
  subject:'Charis SendGrid sandbox validation',
  content:[{type:'text/plain',value:'Sandbox-only request validation. No message is sent.'}],
  mail_settings:{sandbox_mode:{enable:true}}
 },transport);
 if(response.status!==200&&response.status!==202)throw Error('SendGrid did not confirm sandbox validation.');
 return {verified:true as const,sandbox:true as const};
}
