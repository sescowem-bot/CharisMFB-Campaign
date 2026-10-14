import type {Provider} from '../email/validation.ts';
import {mailbox,senderName,matchesDomain} from '../email/validation.ts';
export type SendResult={status:'accepted'|'failed'|'unknown'|'retry';message?:string;reason:string};
export async function sendQueuedEmail(input:{provider:Provider;key:string;mailjetSecret?:string;campaignId?:string;id:string;name:string;from:string;replyTo:string;domain:string;to:string;subject:string;html:string;unsubscribe:string},transport:typeof fetch=fetch):Promise<SendResult> {
 if(!input.key)throw new Error('Provider key missing');
 if(!matchesDomain(input.from,input.domain))throw new Error('Sender domain mismatch');
 const name=senderName(input.name),from=mailbox(input.from),to=mailbox(input.to),replyTo=mailbox(input.replyTo);
 if(!input.subject.trim()||input.subject.length>200||/[\r\n]/.test(input.subject))throw new Error('Invalid subject');
 const unsubscribe=new URL(input.unsubscribe);if(unsubscribe.protocol!=='https:')throw new Error('HTTPS unsubscribe URL required');
 const listHeaders={'List-Unsubscribe':`<${unsubscribe.href}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'};
 const body=input.provider==='resend'?{
  from:`${name} <${from}>`,to:[to],reply_to:replyTo,subject:input.subject,html:input.html,
  headers:listHeaders,tags:[{name:'delivery_id',value:input.id}]
 }:input.provider==='brevo'?{
  sender:{name,email:from},to:[{email:to}],replyTo:{email:replyTo},subject:input.subject,htmlContent:input.html,
  headers:{...listHeaders,'X-Mailin-custom':`charis_delivery=${input.id}`}
 }:{Messages:[{From:{Email:from,Name:name},To:[{Email:to}],ReplyTo:{Email:replyTo},
  Subject:input.subject,HTMLPart:input.html,CustomID:input.id,
  CustomCampaign:'Charis-'+(input.campaignId||input.id).slice(0,24),DeduplicateCampaign:true,Headers:listHeaders}]};
 if(input.provider==='mailjet'&&!input.mailjetSecret)throw new Error('Mailjet secret is missing');
 const endpoint=input.provider==='resend'?'https://api.resend.com/emails':input.provider==='brevo'?'https://api.brevo.com/v3/smtp/email':'https://api.mailjet.com/v3.1/send';
 const auth=input.provider==='resend'?{Authorization:`Bearer ${input.key}`,'Idempotency-Key':`campaign-delivery/${input.id}`}:input.provider==='brevo'?{'api-key':input.key}:{Authorization:`Basic ${Buffer.from(input.key+':'+input.mailjetSecret).toString('base64')}`};
 let response:Response;
 try {response=await transport(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...auth},body:JSON.stringify(body),signal:AbortSignal.timeout(15000),cache:'no-store'});}catch{return {status:'unknown',reason:'network_outcome_unconfirmed'};}
 if(response.status===429)return {status:'retry',reason:'provider_rate_limit'};
 if(!response.ok)return {status:response.status>=500||response.status===408?'unknown':'failed',reason:`provider_http_${response.status}`};
 const result=await response.json().catch(()=>null);
 const mailjetMessage=Array.isArray(result?.Messages)&&result.Messages[0]?.Status==='success'
  ?result.Messages[0]?.To?.[0]?.MessageID:undefined;
 const message=String(input.provider==='mailjet'?mailjetMessage??'':result?.id??result?.messageId??'').replace(/^<|>$/g,'');
 if(!message||message.length>300)return {status:'unknown',reason:'acknowledgement_missing'};
 return {status:'accepted',message,reason:'provider_acknowledged'};
}
