'use server';
import {revalidatePath} from 'next/cache';
import {supabaseServer} from '@/lib/supabase/server';
import {emailServiceDb} from '@/lib/email/server';
import {providerAdapter} from '@/lib/email/providers';
import {mailbox} from '@/lib/email/validation';
import {charisOrgId} from '@/lib/bank';
export type BrevoStaffTestResult={error?:string;success?:string};
/** Real email to ONE preconfigured bank-owned test inbox, never to an arbitrary user-supplied address. */
export async function sendBrevoStaffCheck(_state:BrevoStaffTestResult,_form:FormData):Promise<BrevoStaffTestResult>{
 void _state;void _form;
 let reserved:string|undefined;let org:string|undefined;
 try{
  const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();
  if(!user?.email_confirmed_at)throw Error('Verified bank sign-in required');
  org=charisOrgId()??undefined;if(!org)throw Error('Bank workspace not configured');
  const {data:admin,error:accessError}=await db.rpc('can_manage_senders',{p_org:org});
  if(accessError||admin!==true)throw Error('Provider administrator permission required');
  const to=mailbox(process.env.BREVO_STAFF_TEST_EMAIL||'');
  const apiKey=process.env.BREVO_API_KEY||'';
  if(!apiKey)throw Error('BREVO_API_KEY is missing');
  const service=emailServiceDb();
  const {data:route,error:routeError}=await service.from('charis_email_routes')
   .select('sender_id,enabled,allowed_kind,permission_confirmed').eq('organization_id',org).eq('provider','brevo').maybeSingle();
  if(routeError||!route?.sender_id||!route.enabled||!route.permission_confirmed||route.allowed_kind!=='service')throw Error('Enable the verified Brevo service route in Email Providers first');
  const {data:sender,error:senderError}=await service.from('sender_identities').select('from_name,from_email,reply_to,is_active').eq('organization_id',org).eq('id',route.sender_id).single();
  if(senderError||!sender?.is_active)throw Error('Select an active bank sender');
  const api=providerAdapter('brevo',apiKey);
  await api.findVerifiedBrevoSender(sender.from_email);
  const {data:attempt,error:reserveError}=await db.rpc('charis_brevo_staff_test_reserve_043',{p_org:org});
  if(reserveError||!attempt)throw Error(reserveError?.message||'Unable to reserve staff check');
  reserved=String(attempt);
  let result:'accepted'|'failed'|'uncertain'='uncertain';let providerId='';
  try{
   providerId=await api.sendTest({name:sender.from_name,email:sender.from_email,replyTo:sender.reply_to||sender.from_email,to,domain:sender.from_email.split('@')[1],attempt:reserved,subject:'Charis Brevo service email check',html:'<p>This is one authorised internal Charis bank staff delivery check. No customer or loan data is included.</p>'});
   result='accepted';
  }catch{result='uncertain';}
  const {error:finish}=await service.rpc('charis_brevo_staff_test_finish_043',{p_org:org,p_id:reserved,p_status:result,p_message:providerId||null});
  if(finish)throw Error('Provider outcome could not be recorded. Do not repeat this send.');
  revalidatePath('/admin/providers');
  return result==='accepted'?{success:'Brevo accepted the staff email. Confirm arrival in the authorised inbox.'}:{error:'Provider outcome is unconfirmed. Check Brevo activity before trying again.'};
 }catch(error){return {error:(reserved?'A staff check may have reached Brevo. Do not retry blindly. ':'')+(error instanceof Error?error.message:'Unable to complete staff email check.')};}
}
