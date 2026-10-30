'use server';
import {z} from 'zod';
import {currentAccount} from '@/lib/auth/account';
import {currentVerifiedUser} from '@/lib/auth/current-user';
import {charisOrgId} from '@/lib/bank';
import {supabaseServer} from '@/lib/supabase/server';
import {mailbox} from '@/lib/email/validation';
import {zeptoConfig,zeptoTransport,zeptoSafeError,zeptoLetter} from '@/lib/email/zeptomail';
import {zeptoPurposes} from '@/lib/email/zeptomail-options';
export type ZeptoState={message?:string;error?:string;uncertain?:boolean;id?:string};
/** SMTP testing is available to the verified Platform Super Admin and authorised bank staff.
 * Customer notifications remain bank-staff-only, including when called directly as a server action.
 */
async function access(mode:'test'|'notice'){
 const [account,user]=await Promise.all([currentAccount(),currentVerifiedUser()]);
 if(!account||!user?.email||!user.email_confirmed_at||account.workspace.id!==charisOrgId())
  throw Error('Sign in to your verified Charis account.');
 const email=mailbox(user.email);
 const db=await supabaseServer();
 // account.owner is verified server-side via the is_platform_super_admin database RPC.
 // Even the Platform Super Admin may only send a test to their own verified login email.
 if(mode==='test' && account.owner && account.providerAdmin)return {account,email,db};
 if(email.split('@')[1]!=='charismfb.com')
  throw Error(mode==='test'
   ?'Only verified Charis staff or the Platform Super Admin may test the bank Mail Agent.'
   :'Only verified Charis staff may send customer notifications.');
 const {data:allowed,error}=await db.rpc('charis_direct_can_send',{p_org:account.workspace.id});
 if(error||allowed!==true||(mode==='test'&&!account.providerAdmin))
  throw Error('Your account does not have bank communication permissions.');
 return {account,email,db};
}
/** Authenticates with ZeptoMail without sending a message. */
export async function verifyZepto(_state:ZeptoState,_form:FormData):Promise<ZeptoState>{
 void _state;void _form;
 try{
  if(process.env.ZEPTOMAIL_TEST_ENABLED!=='true')throw Error('ZeptoMail testing must be enabled in Vercel.');
  await access('test');
  const cfg=zeptoConfig(process.env),transport=zeptoTransport(cfg);
  try{await transport.verify();return {message:'ZeptoMail SMTP authentication succeeded. No message was sent.'};}
  catch(e){return {error:zeptoSafeError(e)};}
  finally{transport.close();}
 }catch(e){return {error:e instanceof Error?e.message:'Unable to verify ZeptoMail.'};}
}
/** One real test to the signed-in, verified mailbox only; no arbitrary recipient. */
export async function testZeptoToSelf(_state:ZeptoState,_form:FormData):Promise<ZeptoState>{
 void _state;void _form;
 try{
  if(process.env.ZEPTOMAIL_TEST_ENABLED!=='true')throw Error('Enable ZeptoMail testing before sending a self-test.');
  const {email}=await access('test');
  const cfg=zeptoConfig(process.env),transport=zeptoTransport(cfg);
  try{
   const result=await transport.sendMail({
    from:{name:'Charis Microfinance Bank',address:cfg.from},to:email,replyTo:cfg.from,
    subject:'Charis ZeptoMail connection self-test',
    text:'This is a one-time delivery test of the Charis ZeptoMail Mail Agent. No customer emails were sent.',
    disableFileAccess:true,disableUrlAccess:true
   });
   if(!result.accepted?.some(v=>(typeof v==='string'?v:v.address).toLowerCase()===email))
    return {error:'ZeptoMail did not confirm accepting the test. Check Mail Agent activity before trying again.',uncertain:true};
   return {message:'ZeptoMail accepted one test email addressed to your verified login mailbox. Check your Inbox and the Mail Agent logs.'};
  }catch(e){return {error:zeptoSafeError(e)+' Check Mail Agent activity before retrying.',uncertain:true};}
  finally{transport.close();}
 }catch(e){return {error:e instanceof Error?e.message:'Unable to test ZeptoMail.'};}
}
/** A staff-confirmed SINGLE event-based notification. Not a campaign or mass mail endpoint. */
export async function sendZeptoNotice(_state:ZeptoState,form:FormData):Promise<ZeptoState>{
 void _state;let reservation:string|undefined;
 try{
  if(process.env.ZEPTOMAIL_TRANSACTIONAL_ENABLED!=='true')
   throw Error('Transaction notices are disabled until the Mail Agent self-test and SQL 079 are completed.');
  if(String(form.get('confirmed')||'')!=='yes')
   throw Error('Review and authorise the recipient and message before sending.');
  const {account,email,db}=await access('notice');
  const cfg=zeptoConfig(process.env);
  const purpose=z.enum(zeptoPurposes.map(v=>v.value) as [
   'loan_reminder','account_notice','payment_receipt','customer_request'
  ]).parse(form.get('purpose'));
  const to=mailbox(z.string().max(254).parse(form.get('to')));
  if(to===email)throw Error('Use Send test to myself for staff self-tests.');
  const nonce=z.string().uuid().parse(form.get('nonce'));
  const reference=z.string().min(4).max(120).parse(form.get('reference')).trim();
  const letter=zeptoLetter(z.string().parse(form.get('subject')),z.string().parse(form.get('body')),purpose);
  const {data:id,error}=await db.rpc('charis_zepto_reserve_079',{
   p_org:account.workspace.id,p_nonce:nonce,p_from:cfg.from,p_to:to,
   p_subject:letter.subject,p_purpose:purpose,p_reference:reference
  });
  if(error||!id)throw Error(error?.message||'Unable to reserve a safe delivery record. Confirm SQL 079 is applied.');
  reservation=id;
  const transport=zeptoTransport(cfg);
  let accepted=false,providerId='',status:'accepted'|'uncertain'='uncertain';
  try{
   const result=await transport.sendMail({
    from:{name:'Charis Microfinance Bank',address:cfg.from},to,
    replyTo:email,subject:letter.subject,text:letter.text,html:letter.html,
    disableFileAccess:true,disableUrlAccess:true
   });
   providerId=result.messageId||'';
   accepted=Boolean(result.accepted?.some(v=>(typeof v==='string'?v:v.address).toLowerCase()===to));
   if(accepted)status='accepted';
  }catch{/* No safe blind retry: an SMTP timeout can occur after acceptance. */}
  finally{transport.close();}
  const {data:completed,error:completeError}=await db.rpc('charis_zepto_complete_079',{
   p_org:account.workspace.id,p_id:id,p_status:status,p_provider_id:providerId
  });
  if(completeError||completed!==true)
   return {error:'The delivery record could not be confirmed. Check the ZeptoMail Mail Agent before doing anything else; do not send again.',uncertain:true,id};
  if(!accepted)return {error:'ZeptoMail has not confirmed acceptance. Check Mail Agent activity before attempting another message.',uncertain:true,id};
  return {message:'ZeptoMail accepted this customer-specific notification. Check Mail Agent delivery events for final status.',id};
 }catch(e){
  if(reservation)return {error:'This notice might already have been submitted. Check Mail Agent logs before retrying.',uncertain:true,id:reservation};
  return {error:e instanceof Error?e.message:'Unable to send ZeptoMail notification.'};
 }
}
