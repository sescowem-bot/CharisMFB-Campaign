'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {charisOrgId} from '@/lib/bank';
import {senderAccess,emailServiceDb,refreshDomain} from '@/lib/email/server';
import {escapeHtml} from '@/lib/email/validation';

export type SenderResult={error?:string;success?:string};
/** Legacy sender form remains only for a controlled staff test send.
 * Domain creation, domain reconciliation and sender edits use the dedicated
 * Charis sender actions; legacy multi-company mutations are not accepted.
 */
export async function senderAction(_:SenderResult,form:FormData):Promise<SenderResult> {
 try {
  const org=z.string().uuid().parse(form.get('organization_id'));
  if(!charisOrgId() || org!==charisOrgId())throw new Error('Charis workspace is unavailable.');
  if(form.get('action')!=='test')throw new Error('Use Charis Sender Settings to update the sender.');
  const {db,user}=await senderAccess(org);
  if(!user.email)throw new Error('Verified account email required.');
  const senderId=z.string().uuid().parse(form.get('sender_id'));
  const {data:sender,error:read}=await db.from('sender_identities').select('id,domain_id,from_name,from_email,reply_to,is_active').eq('id',senderId).eq('organization_id',org).eq('is_active',true).single();
  if(read||!sender)throw new Error('Authorised sender unavailable.');
  const {verified,adapter,row}=await refreshDomain(org,sender.domain_id);
  if(!verified||row.charis_connected!==true||row.organization_id!==org)throw new Error('A verified Charis-connected sender is required.');
  const {data:attempt,error}=await db.rpc('email_test_reserve',{p_org:org,p_sender:senderId});
  if(error||!attempt)throw new Error(error?.message||'Could not reserve an authorised sender test.');
  const service=emailServiceDb();
  try {
   const messageId=await adapter.sendTest({name:sender.from_name,email:sender.from_email,replyTo:sender.reply_to,to:user.email,domain:row.domain,attempt,html:`<h1>Sender configuration test</h1><p>This test confirms that ${escapeHtml(sender.from_name)} can submit email using ${escapeHtml(sender.from_email)}.</p><p>This is a configuration test, not a customer campaign.</p>`});
   const {error:log}=await service.from('email_test_attempts').update({status:'accepted',provider_message_id:messageId}).eq('organization_id',org).eq('id',attempt).eq('status','reserved');
   revalidatePath('/dashboard/senders');
   return {success:log?'Provider accepted the test, but history could not be updated. Check the provider dashboard.':`Provider accepted the staff test for ${user.email}. Acceptance is not proof of inbox delivery.`};
  }catch {
   await service.from('email_test_attempts').update({status:'unknown'}).eq('organization_id',org).eq('id',attempt).eq('status','reserved');
   return {error:'Test outcome is unconfirmed. Check the provider dashboard before attempting another test. Never retry an uncertain outcome automatically.'};
  }
 }catch(e){return {error:e instanceof Error?e.message:'Sender request failed.'};}
}
