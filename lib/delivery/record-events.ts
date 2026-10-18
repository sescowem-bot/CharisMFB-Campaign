import 'server-only';
import {emailServiceDb} from '@/lib/email/server';
import type {DeliveryEvent} from '@/lib/delivery/events';

/** Persist in both data models; webhook requests must be retried if either fails. */
export async function recordProviderEvent(provider:'resend'|'brevo'|'mailjet',event:DeliveryEvent,credit=false):Promise<void>{
 const db=emailServiceDb(),args={p_provider:provider,p_key:event.key,p_message:event.message,p_type:event.type,p_time:event.time};
 const results=await Promise.all([
  db.rpc('delivery_event',args),
  db.rpc('charis_direct_event_060',args),
  ...(credit?[db.rpc('charis_brevo_credit_event_043',{
   p_key:event.key,p_message:event.message,p_type:event.type,p_time:event.time})]:[])
 ]);
 if(results.some(result=>result.error))throw Error('One or more provider event stores could not be updated');
}
