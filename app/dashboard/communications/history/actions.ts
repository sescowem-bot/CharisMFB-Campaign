'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
type Result={error?:string;success?:string};
export async function manageDirectHistory(_:Result,form:FormData):Promise<Result>{
 try{
  const account=await currentAccount();if(!account)throw Error('Please sign in.');
  const id=z.uuid().parse(form.get('id'));
  const action=z.enum(['archive','restore','delete_unsent']).parse(form.get('action'));
  const db=await supabaseServer(),org=account.workspace.id;
  const {data:allowed,error:permissionError}=await db.rpc('charis_direct_can_manage_history',{p_org:org});
  if(permissionError||allowed!==true)throw Error('You do not have history-management permission.');
  const {error}=await db.rpc('charis_direct_history_manage',{p_org:org,p_message:id,p_action:action});
  if(error)throw Error(error.message);
  revalidatePath('/dashboard/communications');
  revalidatePath('/dashboard/communications/history');
  return {success:action==='archive'?'Archived. The audit record is preserved.':action==='restore'?'Restored.':'Unsent draft deleted.'};
 }catch(e){return {error:e instanceof Error?e.message:'Unable to update message.'};}
}
