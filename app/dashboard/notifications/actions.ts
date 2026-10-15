'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
export type NotificationResult={error?:string;success?:string};
export async function readStaffNotification(_:NotificationResult,form:FormData):Promise<NotificationResult>{
 try{
  const id=z.string().uuid().parse(form.get('id'));
  const account=await currentAccount();if(!account)throw Error('Sign in required.');
  const db=await supabaseServer();const {error}=await db.rpc('charis_staff_notification_read',{p_org:account.workspace.id,p_id:id});
  if(error)throw Error(error.message);
  revalidatePath('/dashboard/notifications');return {success:'Marked as read.'};
 }catch(e){return {error:e instanceof Error?e.message:'Unable to update notification.'};}
}
