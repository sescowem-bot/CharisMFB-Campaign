'use server';
import {currentAccount} from '@/lib/auth/account';
import {currentVerifiedUser} from '@/lib/auth/current-user';
import {charisOrgId} from '@/lib/bank';
import {mailbox} from '@/lib/email/validation';
import {safeZohoError,verifyZohoStaffSmtp,zohoStaffConfig} from '@/lib/email/zoho-smtp';

export type ZohoCheckState={success?:string;error?:string};

/** Manually verify ONLY the currently signed-in bank staff member's Zoho mailbox. */
export async function checkMyZohoSmtp(_state:ZohoCheckState,_form:FormData):Promise<ZohoCheckState>{
 void _state;void _form;
 try{
  const [account,user]=await Promise.all([currentAccount(),currentVerifiedUser()]);
  if(!account||!user?.email||!user.email_confirmed_at||account.workspace.id!==charisOrgId())
   return {error:'Sign in with your verified Charis bank account first.'};
  if(process.env.ZOHO_SMTP_TEST_ENABLED!=='true')
   return {error:'The administrator has not enabled this restricted SMTP connection test.'};
  const config=zohoStaffConfig(process.env);
  if(mailbox(user.email)!==config.user)
   return {error:'This SMTP connection belongs to another mailbox. Sign in with the matching Charis staff email or configure your own Zoho mailbox in Vercel.'};
  try{await verifyZohoStaffSmtp(config);}
  catch(err){return {error:safeZohoError(err)};}
  return {success:'Your Zoho SMTP login was verified successfully. No email was sent. This does not enable automated customer campaigns.'};
 }catch{return {error:'Zoho SMTP settings are incomplete. Ask the project administrator to configure your mailbox credentials securely.'};}
}
