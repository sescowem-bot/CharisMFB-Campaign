'use server';
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {supabaseServer} from '@/lib/supabase/server';
export type ReminderResult={error?:string;success?:string};
export async function createReminder(_:ReminderResult,form:FormData):Promise<ReminderResult>{
 try{
  const org=z.string().uuid().parse(form.get('org'));
  const dept=z.string().uuid().parse(form.get('department_id'));
  const title=z.string().trim().min(3).max(160).parse(form.get('title'));
  const notes=z.string().max(1500).parse(form.get('notes')||'');
  const priority=z.enum(['low','normal','high']).parse(form.get('priority'));
  const assignee=z.string().uuid().parse(form.get('assigned_to'));
  const date=z.string().datetime({offset:true}).parse(form.get('due_at'));
  const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)throw Error('Verified sign-in required.');
  const {error}=await db.rpc('charis_reminder_save',{p_org:org,p_dept:dept,p_title:title,p_notes:notes,p_due:date,p_priority:priority,p_assignee:assignee});
  if(error)throw Error(error.message);
  revalidatePath('/dashboard/reminders');revalidatePath('/dashboard/departments');
  return {success:'Reminder saved. It will appear on the assigned staff member’s dashboard; no customer message was sent.'};
 }catch(e){return {error:e instanceof Error?e.message:'Unable to save reminder.'};}
}
export async function changeReminderStatus(_:ReminderResult,form:FormData):Promise<ReminderResult>{
 try{
  const org=z.string().uuid().parse(form.get('org'));
  const id=z.string().uuid().parse(form.get('id'));
  const status=z.enum(['open','done','cancelled']).parse(form.get('status'));
  const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)throw Error('Verified sign-in required.');
  const {error}=await db.rpc('charis_reminder_status',{p_org:org,p_id:id,p_status:status});if(error)throw Error(error.message);
  revalidatePath('/dashboard/reminders');return {success:'Reminder updated.'};
 }catch(e){return {error:e instanceof Error?e.message:'Could not update reminder.'};}
}
