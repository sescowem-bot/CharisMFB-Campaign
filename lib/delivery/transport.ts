import type {Provider} from '../email/validation.ts';
import {mailbox,senderName,matchesDomain} from '../email/validation.ts';
export type SendResult={status:'accepted'|'failed'|'unknown'|'retry';message?:string;reason:string};
export async function sendQueuedEmail(input:{provider:Provider;key:string;campaignId?:string;id:string;name:string;from:string;replyTo:string;domain:string;to:string;subject:string;html:string;unsubscribe?:string},transport:typeof fetch=fetch):Promise<SendResult>{
 if(!input.key)throw new Error('Provider key missing');
 if(!matchesDomain(input.from,input.domain))throw new Error('Sender domain mismatch');
 const name=senderName(input.name),from=mailbox(input.from),to=mailbox(input.to),replyTo=mailbox(input.replyTo);
 if(!input.subject.trim()||input.subject.length>200||/[\r\n]/.test(input.subject))throw new Error('Invalid subject');
 const unsubscribe=input.unsubscribe?new URL(input.unsubscribe):null;
 if(unsubscribe&&unsubscribe.protocol!=='https:')throw new Error('HTTPS unsubscribe URL required');
 const body=input.provider==='sendbyte'?{from:`${name} <${from}>`,to:[to],reply_to:replyTo,subject:input.subject,html:input.html,tags:['charis-campaign',input.campaignId||input.id],...(unsubscribe?{list_unsubscribe:{url:unsubscribe.href}}:{})}
 :input.provider==='resend'?{from:`${name} <${from}>`,to:[to],reply_to:replyTo,subject:input.subject,html:input.html,headers:unsubscribe?{'List-Unsubscribe':`<${unsubscribe.href}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}:{},tags:[{name:'delivery_id',value:input.id}]}
 :{sender:{name,email:from},to:[{email:to}],replyTo:{email:replyTo},subject:input.subject,htmlContent:input.html,headers:{...(unsubscribe?{'List-Unsubscribe':`<${unsubscribe.href}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}:{}),'X-Mailin-custom':`charis_delivery=${input.id}`}};
 const endpoint=input.provider==='sendbyte'?'https://api.sendbyte.africa/v1/emails':input.provider==='resend'?'https://api.resend.com/emails':'https://api.brevo.com/v3/smtp/email';
 const headers:Record<string,string>={'Content-Type':'application/json'};
 if(input.provider==='brevo')headers['api-key']=input.key;else headers.Authorization=`Bearer ${input.key}`;
 if(input.provider==='resend')headers['Idempotency-Key']=`campaign-delivery/${input.id}`;
 if(input.provider==='sendbyte')headers['X-SendByte-Idempotency-Key']=`charis-campaign-${input.id}`;
 let response:Response;
 try{response=await transport(endpoint,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(20000),cache:'no-store'});}catch{return {status:'unknown',reason:'network_outcome_unconfirmed'};}
 if(response.status===429)return {status:'retry',reason:'provider_rate_limit'};
 if(!response.ok)return {status:response.status>=500||response.status===408?'unknown':'failed',reason:`provider_http_${response.status}`};
 const rawResult=await response.json().catch(()=>null),result=rawResult?.data??rawResult,message=String(result?.id??result?.messageId??'').replace(/^<|>$/g,'');
 if(!message||message.length>300)return {status:'unknown',reason:'acknowledgement_missing'};
 return {status:'accepted',message,reason:'provider_acknowledged'};
}
