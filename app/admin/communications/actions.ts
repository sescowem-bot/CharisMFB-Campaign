 'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
type State={error?:string;success?:string};
export async function directAdminAction(_:State,form:FormData):Promise<State>{
 try{const account=await currentAccount();if(!account)throw Error('Sign in first');const db=await supabaseServer(),org=account.workspace.id;
  const {data:allowed,error:permissionError}=await db.rpc('charis_direct_is_admin',{p_org:org});if(permissionError||allowed!==true)throw Error('Super Admin or bank communication administrator required');
  const action=z.enum(['settings','provider','staff','history']).parse(form.get('action'));let error;
  if(action==='settings'){
   const n=z.coerce.number().int().min(1).max(50).parse(form.get('max_recipients'));
   ({error}=await db.rpc('charis_direct_settings_save',{p_org:org,p_approval:form.get('approval')==='on',p_email:form.get('email')==='on',p_sms:form.get('sms')==='on',p_max:n}));
  }else if(action==='provider'){
   ({error}=await db.rpc('charis_direct_provider_save',{p_org:org,p_provider:z.enum(['resend','brevo','mailjet']).parse(form.get('provider')),p_sender:z.uuid().parse(form.get('sender')),p_enabled:form.get('enabled')==='on',p_priority:z.coerce.number().int().min(1).max(100).parse(form.get('priority'))}));
  }else if(action==='staff'){
   ({error}=await db.rpc('charis_direct_staff_rule_save',{p_org:org,p_user:z.uuid().parse(form.get('user')),p_can_send:form.get('can_send')==='yes'}));
  }else{
   ({error}=await db.rpc('charis_direct_history_access_save',{p_org:org,p_user:z.uuid().parse(form.get('user')),p_allowed:form.get('can_manage_history')==='yes'}));
  }
  if(error)throw Error(error.message);
  revalidatePath('/admin/communications');revalidatePath('/dashboard/communications');
  return {success:'Communication settings saved.'};
 }catch(e){return {error:e instanceof Error?e.message:'Could not update communication settings.'};}
}
