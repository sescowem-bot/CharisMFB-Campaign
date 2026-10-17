'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
import {requestResubscription} from '@/lib/preferences/resubscribe';
type State={error?:string;success?:string};
export async function subscriptionAdminAction(_:State,form:FormData):Promise<State>{
 try{
  const account=await currentAccount();if(!account)throw Error('Sign in required');
  const db=await supabaseServer(),org=account.workspace.id;
  const mode=z.enum(['invite','delegate']).parse(form.get('mode'));
  if(mode==='invite'){
   const {data:allowed,error:permissionError}=await db.rpc('charis_subscription_can',{p_org:org,p_action:'invite'});
   if(permissionError||allowed!==true)throw Error('Permission to invite customers is required');
   if(form.get('customer_requested')!=='on')throw Error('Confirm the customer requested this invitation.');
   const email=z.email().max(254).parse(form.get('email'));
   const outcome=await requestResubscription(email,'staff',account.id);
   revalidatePath('/admin/subscriptions');
   return outcome.accepted?{success:'Confirmation email accepted by the provider. The customer must confirm.'}:{success:'No confirmation sent. Check address, sending provider and request limits.'};
  }
  const {data:admin,error:adminError}=await db.rpc('charis_direct_is_admin',{p_org:org});
  if(adminError||admin!==true)throw Error('Administrator access required to assign roles');
  const user=z.uuid().parse(form.get('user'));
  const view=form.get('view')==='on',invite=form.get('invite')==='on';
  const {error}=await db.rpc('charis_subscription_delegate',{p_org:org,p_user:user,p_view:view,p_invite:invite});
  if(error)throw Error(error.message);
  revalidatePath('/admin/subscriptions');
  return {success:'Staff permission updated.'};
 }catch(e){return {error:e instanceof Error?e.message:'Could not update email preferences'};}
}
