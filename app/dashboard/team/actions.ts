'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {createClient} from '@supabase/supabase-js';
import {supabaseServer} from '@/lib/supabase/server';
export type ManagementResult={error?:string;success?:string};
export async function teamAction(_:ManagementResult,form:FormData):Promise<ManagementResult>{
 try{const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)throw new Error('Verified sign-in required.');const org=z.string().uuid().parse(form.get('org'));const email=z.string().email().max(254).parse(form.get('email'));const role=z.enum(['company_admin','manager','campaign_lead','designer','approver','analyst','viewer','remove']).parse(form.get('role'));const {error}=await db.rpc('team_member_save',{p_org:org,p_email:email,p_role:role});if(error)throw new Error(error.message);revalidatePath('/dashboard/team');revalidatePath('/dashboard');return {success:'Company membership updated. No invitation email was sent.'};}catch(e){const message=e instanceof Error?e.message:'Team update failed.';return {error:message.includes('Keep at least one company administrator')?'Charis must retain one company administrator. Add another administrator before changing the current admin role.':message.includes('A verified account is required')?'This user is not verified. Use Invite Staff to send an invitation, then ask the person to accept it.':message};}
}
export async function companySettingsAction(_:ManagementResult,form:FormData):Promise<ManagementResult>{
 try{const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)throw new Error('Verified sign-in required.');const org=z.string().uuid().parse(form.get('org')),status=z.enum(['pending','active','suspended']).parse(form.get('status'));const raw=form.get('monthly');const monthly=raw===''?null:z.coerce.number().int().min(0).max(10000000).parse(raw);const {error}=await db.rpc('admin_company_settings',{p_org:org,p_status:status,p_monthly:monthly});if(error)throw new Error(error.message);revalidatePath('/admin/companies');revalidatePath('/dashboard/delivery');return {success:'Company settings updated. Paused campaigns require manual review and resume.'};}catch(e){return {error:e instanceof Error?e.message:'Company update failed.'};}
}

// Only the authenticated Charis company administrator can request an Auth invitation.
// Service-role credentials are never sent to the browser.
export async function inviteStaffAction(_:ManagementResult,form:FormData):Promise<ManagementResult>{
 try{
  const db=await supabaseServer();
  const {data:{user}}=await db.auth.getUser();
  if(!user?.email_confirmed_at)throw new Error('Please sign in with a verified account.');
  const org=z.string().uuid().parse(form.get('org'));
  if(process.env.SINGLE_COMPANY_MODE==='true'&&org!==process.env.SINGLE_COMPANY_ORG_ID)throw new Error('Invalid Charis workspace.');
  const email=z.string().email().max(254).parse(form.get('email')).trim().toLowerCase();
  const role=z.enum(['company_admin','manager','campaign_lead','designer','approver','analyst','viewer']).parse(form.get('role'));
  const {data:authorized,error:accessError}=await db.rpc('can_manage_team',{p_org:org});
  if(accessError||authorized!==true)throw new Error('Only Charis administrators can invite staff.');
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const site=process.env.NEXT_PUBLIC_APP_URL;
  if(!url||!key||!site||!site.startsWith('https://'))throw new Error('Staff invitation service is not yet configured. Check server credentials and application URL.');
  const {data:prepared,error:prepareError}=await db.rpc('team_invite_prepare',{p_org:org,p_email:email,p_role:role});
  if(prepareError)throw new Error(prepareError.message);
  if(prepared==='member_added'){
   revalidatePath('/dashboard/team');
   return {success:`${email} already has a verified Charis login. Company access has been assigned.`};
  }
  const admin=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
  const redirectTo=new URL('/auth/setup-password',site).toString();
  const {error}=await admin.auth.admin.inviteUserByEmail(email,{redirectTo,data:{invited_by_app:'charis-campaign-centre'}});
  if(error)throw new Error(`The invitation could not be emailed. ${error.message}. You can retry after checking Supabase Auth email configuration.`);
  revalidatePath('/dashboard/team');
  return {success:`Invitation sent to ${email}. The role will be applied when the staff member verifies their email and signs in.`};
 }catch(e){return {error:e instanceof Error?e.message:'Staff invitation failed.'};}
}
export async function cancelInviteAction(_:ManagementResult,form:FormData):Promise<ManagementResult>{
 try{
  const db=await supabaseServer();
  const {data:{user}}=await db.auth.getUser();
  if(!user?.email_confirmed_at)throw new Error('Sign in required.');
  const org=z.string().uuid().parse(form.get('org'));
  const id=z.string().uuid().parse(form.get('id'));
  const {error}=await db.rpc('team_invitation_cancel',{p_org:org,p_id:id});
  if(error)throw new Error(error.message);
  revalidatePath('/dashboard/team');
  return {success:'Invitation cancelled. The invitation can no longer grant Charis access.'};
 }catch(e){return {error:e instanceof Error?e.message:'Unable to cancel invitation.'};}
}
