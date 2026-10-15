'use server';
import {supabaseServer} from '@/lib/supabase/server';
import {charisOrgId} from '@/lib/bank';
import {verifySendgridDomain,verifySendgridSandbox} from '@/lib/email/sendgrid';
export type SendgridCheckState={success?:string;error?:string};
/** These actions NEVER send a real message or enable any delivery gates. */
export async function checkSendgrid(_:SendgridCheckState,form:FormData):Promise<SendgridCheckState>{
 try{
  const db=await supabaseServer();
  const {data:{user}}=await db.auth.getUser();
  if(!user?.email_confirmed_at)throw Error('Verified staff sign-in required.');
  const org=charisOrgId();if(!org)throw Error('Charis organisation is not configured.');
  const {data:admin,error}=await db.rpc('can_manage_senders',{p_org:org});
  if(error||admin!==true)throw Error('Provider administrator permission required.');
  const apiKey=process.env.SENDGRID_API_KEY||'';
  const from=process.env.SENDGRID_FROM_EMAIL||'';
  const operation=form.get('operation');
  if(operation==='domain'){
   const value=await verifySendgridDomain({apiKey,from});
   return {success:`SendGrid confirmed ${value.domain} is authenticated. This does not enable sending.`};
  }
  if(operation==='sandbox'){
   const to=process.env.SENDGRID_STAFF_TEST_EMAIL||'';
   if(!to)throw Error('Set SENDGRID_STAFF_TEST_EMAIL to an authorised bank staff mailbox first.');
   await verifySendgridSandbox({apiKey,from,to});
   return {success:'SendGrid accepted the sandbox request. No email was sent. Customer sending remains disabled.'};
  }
  throw Error('Unknown verification operation.');
 }catch(error){return {error:error instanceof Error?error.message:'SendGrid check failed.'};}
}
