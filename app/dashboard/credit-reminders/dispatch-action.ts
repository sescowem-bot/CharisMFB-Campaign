'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
import {emailServiceDb} from '@/lib/email/server';
import {sendBrevoLoanNotice} from '@/lib/email/loan-service';
export type LoanDispatchResult={error?:string;success?:string};
type Claim={dispatch_id:string;recipient:string;subject:string;message:string;sender:string;sender_name:string;reply_to:string};
/** Sends ONE individually claimed, approved loan email. Requires bank and provider approval.
 * Never handles marketing, never automatically retries and never sends SMS.
 */
export async function dispatchHeldLoanEmail(_:LoanDispatchResult,form:FormData):Promise<LoanDispatchResult>{
 let reserved:Claim|undefined;let org='';
 try{
  if(process.env.CHARIS_LOAN_EMAIL_DELIVERY_ENABLED!=='true'||process.env.CHARIS_LOAN_EMAIL_POLICY_APPROVED!=='true')
   throw Error('Loan customer email sending is not yet authorised in bank configuration.');
  const account=await currentAccount();if(!account?.permissions.includes('credit_reminders.dispatch')||!account.permissions.includes('credit_reminders.queue'))throw Error('Loan reminder sending access required.');
  const values=z.object({hold:z.uuid(),reconciled:z.literal('yes')}).parse({hold:form.get('hold_id'),reconciled:form.get('reconciled')});
  org=account.workspace.id;
  if(org!==process.env.SINGLE_COMPANY_ORG_ID)throw Error('Invalid Charis workspace');
  if(!process.env.BREVO_API_KEY||!process.env.BREVO_WEBHOOK_SECRET)throw Error('Brevo service provider and event security have not been configured.');
  const db=await supabaseServer();
  const {data,error}=await db.rpc('charis_credit_email_claim_043',{p_org:org,p_hold:values.hold});
  if(error)throw Error(error.message);
  const parsed=z.object({dispatch_id:z.uuid(),recipient:z.string().email(),subject:z.string().min(1),message:z.string().min(1),sender:z.string().email(),sender_name:z.string(),reply_to:z.string().email()}).parse(data);
  reserved=parsed;
  const result=await sendBrevoLoanNotice({to:parsed.recipient,from:parsed.sender,replyTo:parsed.reply_to,name:parsed.sender_name,subject:parsed.subject,message:parsed.message,dispatchId:parsed.dispatch_id},process.env.BREVO_API_KEY);
  const service=emailServiceDb();
  const {error:finish}=await service.rpc('charis_credit_email_finish_043',{p_org:org,p_dispatch:parsed.dispatch_id,p_status:result.status,p_message:result.messageId||null,p_reason:result.reason});
  if(finish)throw Error('Provider response could not be recorded. Reconcile manually before any other send.');
  revalidatePath('/dashboard/credit-reminders');
  if(result.status!=='accepted')return {error:result.status==='uncertain'?'Brevo response uncertain. Check provider activity; do not send this loan reminder again.':'Brevo declined this message. Review provider access before creating any new reminder.'};
  return {success:'Brevo accepted this loan reminder. Delivery to the customer is not yet confirmed.'};
 }catch(error){
  if(reserved)return {error:'A dispatch was reserved and the outcome may be uncertain. Do not resend; review the provider and delivery record. '+(error instanceof Error?error.message:'')};
  return {error:error instanceof Error?error.message:'Unable to send loan reminder.'};
 }
}
