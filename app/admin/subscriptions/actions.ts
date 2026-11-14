'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
type State={error?:string;success?:string};
export async function subscriptionAdminAction(_:State,form:FormData):Promise<State>{
 try{
  const account=await currentAccount();if(!account)throw Error('Sign in required');
  const db=await supabaseServer(),org=account.workspace.id;
  const {data:admin,error:adminError}=await db.rpc('charis_direct_is_admin',{p_org:org});
  if(adminError||admin!==true)throw Error('Administrator access required.');
  const user=z.uuid().parse(form.get('user'));
  const view=form.get('view')==='on';
  const {error}=await db.rpc('charis_subscription_delegate',{p_org:org,p_user:user,p_view:view,p_invite:false});
  if(error)throw Error(error.message);
  revalidatePath('/admin/subscriptions');
  return {success:'Staff access updated.'};
 }catch(e){return {error:e instanceof Error?e.message:'Could not update email preference access.'};}
}
