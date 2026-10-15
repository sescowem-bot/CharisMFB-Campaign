/** Bank-authorised SERVICE notice delivery via Brevo transactional email.
 * This adapter must not be used for marketing or debt collection where provider policy disallows it.
 * No retry for unknown results. The database owns deduplication and audit state.
 */
import {mailbox,senderName} from './validation.ts';
export type LoanNoticeOutcome={status:'accepted'|'failed'|'uncertain';reason:string;messageId?:string};
export type LoanNotice={to:string;from:string;replyTo:string;name:string;subject:string;message:string;dispatchId:string};
function escapeHtml(s:string){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
export async function sendBrevoLoanNotice(input:LoanNotice,apiKey:string,transport:typeof fetch=fetch):Promise<LoanNoticeOutcome>{
 if(!apiKey)throw Error('Brevo credentials are missing');
 const to=mailbox(input.to),from=mailbox(input.from),replyTo=mailbox(input.replyTo),name=senderName(input.name);
 if(!/^[0-9a-f-]{36}$/i.test(input.dispatchId))throw Error('Invalid dispatch reference');
 if(!input.subject.trim()||input.subject.length>140||/[\r\n]/.test(input.subject))throw Error('Invalid notice subject');
 if(!input.message.trim()||input.message.length>1500)throw Error('Invalid notice text');
 const html=`<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;line-height:1.6;color:#17203c"><div style="padding:16px 20px;background:#45239a;color:#fff"><strong>Charis Microfinance Bank</strong></div><div style="padding:22px;white-space:pre-wrap">${escapeHtml(input.message)}</div><p style="font-size:12px;color:#64748b;padding:0 22px 20px">For questions about your account, contact Charis through its official channels. Do not share a PIN or password by email.</p></div>`;
 let response:Response;
 try{response=await transport('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'Content-Type':'application/json','api-key':apiKey},body:JSON.stringify({sender:{name,email:from},replyTo:{email:replyTo},to:[{email:to}],subject:input.subject,htmlContent:html,headers:{'X-Charis-Dispatch-ID':input.dispatchId}}),cache:'no-store',signal:AbortSignal.timeout(15000)});}
 catch{return {status:'uncertain',reason:'brevo_response_unknown_check_dashboard_do_not_retry'};}
 if(!response.ok)return {status:response.status>=500||response.status===408?'uncertain':'failed',reason:`brevo_http_${response.status}`};
 const body:unknown=await response.json().catch(()=>null);
 const id=body&&typeof body==='object'&&!Array.isArray(body)?(body as Record<string,unknown>).messageId:undefined;
 if(typeof id!=='string'||!id||id.length>300)return {status:'uncertain',reason:'brevo_acknowledgement_missing_do_not_retry'};
 return {status:'accepted',reason:'brevo_accepted_not_proof_of_delivery',messageId:id};
}
