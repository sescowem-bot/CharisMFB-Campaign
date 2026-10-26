'use server';
import {z} from 'zod';
import {currentAccount} from '@/lib/auth/account';
import {currentVerifiedUser} from '@/lib/auth/current-user';
import {charisOrgId} from '@/lib/bank';
import {supabaseServer} from '@/lib/supabase/server';
import {mailbox} from '@/lib/email/validation';
import {formatZohoManualLetter,validateZohoManualRecipient} from '@/lib/email/zoho-manual';
import {safeZohoError,zohoStaffConfig,zohoStaffTransport} from '@/lib/email/zoho-smtp';

export type ZohoManualResult={success?:string;error?:string;uncertain?:boolean;id?:string};

async function personalAccess(){
 const [account,user]=await Promise.all([currentAccount(),currentVerifiedUser()]);
 if(!account||!user?.email||!user.email_confirmed_at||account.workspace.id!==charisOrgId())
  throw Error('Sign in with your verified bank account.');
 const config=zohoStaffConfig(process.env);
 if(config.user!==mailbox(user.email))
  throw Error('This Zoho connection is for a different staff mailbox.');
 return {account,user,config};
}

/** A real but controlled one-email self-test. No customer data, contacts or arbitrary destinations. */
export async function sendMyZohoSelfTest(_state:ZohoManualResult,_form:FormData):Promise<ZohoManualResult>{
 void _state;void _form;
 try{
  if(process.env.ZOHO_SMTP_TEST_ENABLED!=='true')throw Error('Enable your Zoho SMTP connection test in Vercel first.');
  const {config}=await personalAccess();
  const transport=zohoStaffTransport(config);
  try{
   const result=await transport.sendMail({
    from:{name:'Charis Staff Mailbox Check',address:config.user},to:config.user,replyTo:config.user,
    subject:'My Charis Zoho mailbox test',
    text:'This is one manually requested personal SMTP test. No customer data or contact list was used.',
    disableFileAccess:true,disableUrlAccess:true
   });
   if(!result.accepted?.some(x=>(typeof x==='string'?x:x.address).toLowerCase()===config.user))return {error:'Zoho did not confirm accepting your self-test. Please check your mailbox before retrying.',uncertain:true};
   return {success:'Zoho accepted one test email to your own mailbox. Check your Inbox or Spam folder.'};
  }catch(e){return {error:safeZohoError(e)+' If uncertain, check your inbox before retrying.',uncertain:true};}
  finally{transport.close();}
 }catch(e){return {error:e instanceof Error?e.message:'Unable to test Zoho mailbox.'};}
}

/** One recipient, typed by the staff member, sent only when the human confirms. */
export async function sendManualZohoLetter(_state:ZohoManualResult,form:FormData):Promise<ZohoManualResult>{
 void _state;
 let reservedId:string|undefined;
 try{
  if(process.env.ZOHO_SMTP_MANUAL_CLIENT_ENABLED!=='true')
   throw Error('Client correspondence will be available after an administrator enables the Zoho manual sending setting.');
  const {account,config}=await personalAccess();
  if(String(form.get('confirmed')||'')!=='yes')throw Error('Review and confirm the client email first.');
  const nonce=z.string().uuid().parse(form.get('nonce'));
  const to=validateZohoManualRecipient(z.string().max(254).parse(form.get('to')),config.user);
  const letter=formatZohoManualLetter(z.string().parse(form.get('subject')),z.string().parse(form.get('body')));
  const db=await supabaseServer();
  const {data:allowed,error:canSendError}=await db.rpc('charis_direct_can_send',{p_org:account.workspace.id});
  if(canSendError||allowed!==true)throw Error('Your Charis account is not permitted to send client correspondence.');
  const {data:id,error:reserveError}=await db.rpc('charis_zoho_manual_reserve_077',{
   p_org:account.workspace.id,p_nonce:nonce,p_sender:config.user,p_to:to,p_subject:letter.subject
  });
  if(reserveError||!id)throw Error(reserveError?.message||'Unable to reserve a delivery record. Check whether SQL 077 has been applied.');
  reservedId=id;
  const transport=zohoStaffTransport(config);
  let outcome:'accepted'|'uncertain'='uncertain';
  let providerId='';
  let auditSaved=false;
  try{
   const result=await transport.sendMail({
    from:{name:'Charis Microfinance Bank',address:config.user},
    to,replyTo:config.user,subject:letter.subject,text:letter.text,html:letter.html,
    disableFileAccess:true,disableUrlAccess:true
   });
   providerId=result.messageId||'';
   if(result.accepted?.some(x=>(typeof x==='string'?x:x.address).toLowerCase()===to))outcome='accepted';
  }catch{return {error:'Zoho has not confirmed the result. This email may have been sent. Check your Zoho Sent folder before taking further action.',uncertain:true,id:reservedId};}
  finally{
   transport.close();
   try{
    const {data:marked,error:markError}=await db.rpc('charis_zoho_manual_complete_077',{
     p_org:account.workspace.id,p_id:reservedId,p_status:outcome,p_provider_id:providerId
    });
    auditSaved=!markError&&marked===true;
   }catch{/* A reserved record continues blocking accidental duplicate submission. */}
  }
  if(!auditSaved)return {error:'Zoho may have accepted this message, but its audit record could not be confirmed. Check Zoho Sent and ask your administrator; do not send it again.',uncertain:true,id:reservedId};
  if(outcome!=='accepted')return {error:'Delivery was not confirmed by Zoho. Check your Sent folder before attempting another message.',uncertain:true,id:reservedId};
  return {success:'Zoho accepted your email to '+to+'. You can check your Zoho Sent folder or wait for a reply. Inbox delivery is not guaranteed.',id:reservedId};
 }catch(e){
  if(reservedId)return {error:'This message may already have been submitted. Check Zoho Sent before sending another copy.',uncertain:true,id:reservedId};
  return {error:e instanceof Error?e.message:'Unable to send this individual client email.'};
 }
}
