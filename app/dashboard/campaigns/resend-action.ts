'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {supabaseServer} from '@/lib/supabase/server';
import {emailServiceDb,refreshDomain} from '@/lib/email/server';
import {renderCampaign} from '@/lib/campaigns/render';
import {broadcastClient,ResendRequestError} from '@/lib/email/resend-broadcasts';
export type ResendBroadcastResult={error?:string;success?:string};

/** Approved customer marketing only: this function never sends loan or collection notices. */
export async function sendApprovedResendBroadcast(_:ResendBroadcastResult,form:FormData):Promise<ResendBroadcastResult>{
 let runId:string|undefined;
 let step:'preflight'|'building'|'submitting'='preflight';
 try{
  if(process.env.CHARIS_RESEND_BROADCASTS_ENABLED!=='true'||process.env.EMAIL_DELIVERY_ENABLED!=='true')throw Error('Resend marketing has not been enabled by the bank administrator.');
  const origin=new URL(process.env.NEXT_PUBLIC_APP_URL||'');
  if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password)throw Error('Configure NEXT_PUBLIC_APP_URL as the public HTTPS application origin.');
  const org=z.string().uuid().parse(form.get('organization_id'));
  if(org!==process.env.SINGLE_COMPANY_ORG_ID)throw Error('Bank workspace mismatch.');
  const id=z.string().uuid().parse(form.get('campaign_id'));
  const revision=z.coerce.number().int().positive().parse(form.get('revision'));
  if(form.get('confirmed')!=='yes')throw Error('Confirm that recipients opted in and the content is approved.');
  const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();
  if(!user?.email_confirmed_at)throw Error('Sign in with a verified bank account.');
  const {data:allowed,error:permissionError}=await db.rpc('can_dispatch_campaigns',{p_org:org});
  const {data:granular}=await db.rpc('charis_has_permission',{p_org:org,p_key:'campaigns.send'});
  if(permissionError||allowed!==true||granular!==true)throw Error('Sending permission required.');
  const {data:campaign,error:campaignError}=await db.from('campaign_drafts').select('id,revision,status,subject,design,sender_id,requested_send_at').eq('id',id).eq('organization_id',org).single();
  if(campaignError||!campaign||campaign.status!=='approved'||campaign.revision!==revision)throw Error('Campaign needs current approval.');
  if(campaign.requested_send_at)throw Error('Scheduled Resend broadcasts require ongoing consent synchronization. Set the campaign to send immediately and obtain fresh approval.');
  const service=emailServiceDb();
  const {data:sender}=await service.from('sender_identities').select('id,domain_id').eq('id',campaign.sender_id).eq('organization_id',org).eq('is_active',true).single();
  if(!sender)throw Error('Select an active bank sender.');
  const verified=await refreshDomain(org,sender.domain_id);
  if(!verified.verified||verified.row.provider!=='resend')throw Error('Choose an authenticated Resend sender.');
  const apiKey=process.env.RESEND_API_KEY||'';const resend=broadcastClient(apiKey);
  // This atomic RPC reserves the already-approved recipients using the existing
  // bank eligibility/suppression logic, and pauses the ordinary delivery worker.
  const {data:run,error:reserveError}=await db.rpc('charis_resend_broadcast_prepare',{p_org:org,p_campaign:id,p_revision:revision});
  if(reserveError||typeof run!=='string')throw Error(reserveError?.message||'Unable to reserve the approved marketing audience.');
  runId=run;step='building';
  const {data:claimed,error:claimError}=await service.from('charis_resend_broadcast_jobs').update({status:'building',updated_at:new Date().toISOString()}).eq('organization_id',org).eq('run_id',run).eq('status','preparing').select('run_id,recipient_count').single();
  if(claimError||!claimed)throw Error('Broadcast preparation is already in progress.');
  const [{data:runRow,error:runError},{data:deliveries,error:deliveryError}]=await Promise.all([
   service.from('campaign_runs').select('snapshot,scheduled_at').eq('id',run).eq('organization_id',org).single(),
   service.from('email_deliveries').select('contact_id,recipient_email').eq('organization_id',org).eq('run_id',run).limit(51)
  ]);
  if(runError||deliveryError||!runRow||!deliveries?.length||deliveries.length!==claimed.recipient_count)throw Error('Approved recipient snapshot is incomplete. No email has been submitted.');
  const contacts=await service.from('contacts').select('id,email,first_name,last_name,consent_status,unsubscribed_at,archived_at').eq('organization_id',org).in('id',deliveries.map(d=>d.contact_id));
  if(contacts.error||contacts.data?.length!==deliveries.length)throw Error('Recipient consent records are unavailable.');
  const suppressed=await service.from('email_suppressions').select('email').eq('organization_id',org).in('email',deliveries.map(d=>d.recipient_email));
  if(suppressed.error)throw Error('Recipient suppression records could not be checked.');
  const suppressedSet=new Set((suppressed.data||[]).map(r=>r.email.toLowerCase()));
  const contactsById=new Map((contacts.data||[]).map(c=>[c.id,c]));
  for(const d of deliveries){const c=contactsById.get(d.contact_id);
   if(!c||c.email?.toLowerCase()!==d.recipient_email.toLowerCase()||c.consent_status!=='granted'||c.unsubscribed_at||c.archived_at||suppressedSet.has(d.recipient_email.toLowerCase()))
    throw Error('Recipient consent or suppression changed. No broadcast submitted. Review the audience and create a new approved campaign.');
  }
  const snapshot=runRow.snapshot as {campaign:{design:unknown;subject:string;preheader?:string};brand:{display_name:string;postal_address:string;primary_color:string};sender:{from_name:string;from_email:string}};
  const data=JSON.stringify(snapshot.campaign.design);
  if(/\{\{\s*(?:attributes\.|email\b)/i.test(data)||/\{\{\s*attributes\./i.test(snapshot.campaign.subject))throw Error('Resend Broadcast currently supports first and last name personalization only. Remove private/account-specific variables.');
  const FIRST='CHARIS_BROADCAST_FIRST_SENTINEL',LAST='CHARIS_BROADCAST_LAST_SENTINEL';
  const unsubscribe='https://charis-campaign.invalid/unsubscribe-resend-placeholder';
  const rendered=renderCampaign({design:snapshot.campaign.design,subject:snapshot.campaign.subject,preheader:snapshot.campaign.preheader,company:snapshot.brand.display_name,address:snapshot.brand.postal_address,color:snapshot.brand.primary_color,contact:{first_name:FIRST,last_name:LAST},unsubscribeUrl:unsubscribe});
  const html=rendered.html.replaceAll(unsubscribe,'{{{RESEND_UNSUBSCRIBE_URL}}}').replaceAll(FIRST,'{{{contact.first_name|Customer}}}').replaceAll(LAST,'{{{contact.last_name|}}}');
  const subject=rendered.subject.replaceAll(FIRST,'{{{contact.first_name|Customer}}}').replaceAll(LAST,'{{{contact.last_name|}}}');
  const segmentId=await resend.segment(`Charis approved campaign ${id.slice(0,8)} ${run.slice(0,8)}`);
  await service.from('charis_resend_broadcast_jobs').update({segment_id:segmentId,updated_at:new Date().toISOString()}).eq('run_id',run);
  let included=0;
  for(let offset=0;offset<deliveries.length;offset+=5){
   const block=deliveries.slice(offset,offset+5);
   const results=await Promise.all(block.map(d=>{const c=contactsById.get(d.contact_id)!;return resend.addEligibleContact(d.recipient_email,c.first_name||'',c.last_name||'',segmentId);}));
   included+=results.filter(Boolean).length;
  }
  if(included<1)throw Error('All selected recipients are unsubscribed in Resend. No email was sent.');
  // Check bank-side revocations again after provider contact synchronization.
  const {data:recentContacts,error:recentError}=await service.from('contacts').select('id,email,consent_status,unsubscribed_at,archived_at').eq('organization_id',org).in('id',deliveries.map(d=>d.contact_id));
  const {data:newSuppressions,error:newSuppressionsError}=await service.from('email_suppressions').select('email').eq('organization_id',org).in('email',deliveries.map(d=>d.recipient_email));
  if(recentError||newSuppressionsError||recentContacts?.length!==deliveries.length||recentContacts.some(c=>c.consent_status!=='granted'||c.unsubscribed_at||c.archived_at)||newSuppressions?.length)throw Error('The bank audience changed while preparing; no email was submitted.');
  const broadcastId=await resend.draft({segmentId,from:snapshot.sender.from_email,name:snapshot.sender.from_name,subject,html});
  const {error:draftStoreError}=await service.from('charis_resend_broadcast_jobs').update({status:'ready',broadcast_id:broadcastId,recipient_count:included,updated_at:new Date().toISOString()}).eq('run_id',run);
  if(draftStoreError)throw Error('Provider broadcast draft could not be recorded. No send was attempted; reconcile the Resend draft.');
  // A provider timeout at this point may mean it accepted the send. Never retry automatically.
  step='submitting';
  const {data:lock,error:lockError}=await service.from('charis_resend_broadcast_jobs').update({status:'submitting',updated_at:new Date().toISOString()}).eq('run_id',run).eq('status','ready').select('id').single();
  if(lockError||!lock)throw Error('Sending has already been submitted or locked.');
  await resend.send(broadcastId);
  const {error:ackSaveError}=await service.from('charis_resend_broadcast_jobs').update({status:'submitted',last_error:null,updated_at:new Date().toISOString()}).eq('run_id',run);
  if(ackSaveError)throw Error('Resend accepted the broadcast but the Charis acknowledgement could not be saved. Reconcile before retrying.');
  await service.from('audit_logs').insert({organization_id:org,actor_id:user.id,action:'resend.marketing_broadcast_submitted',entity_type:'campaign',entity_id:id,details:{run_id:run,broadcast_id:broadcastId,recipients:included}});
  revalidatePath('/dashboard/campaigns');revalidatePath('/dashboard/delivery');
  return {success:`Submitted ${included} opted-in recipient${included===1?'':'s'} to Resend Broadcasts from Charis. This confirms provider submission, not inbox delivery. See Delivery status.`};
 }catch(e){
  if(runId){
   try{const service=emailServiceDb();const state=step==='submitting'?'uncertain':'failed';
    await service.from('charis_resend_broadcast_jobs').update({status:state,last_error:step==='submitting'?'Resend submission outcome unknown: reconcile in Resend dashboard. Do not resend.':e instanceof Error?e.message.slice(0,220):'Preparation failed',updated_at:new Date().toISOString()}).eq('run_id',runId).neq('status','submitted');
   }catch{/* Preserve initial error; manual reconciliation still required. */}
  }
  const message=e instanceof Error?e.message:'Broadcast could not be submitted.';
  return {error:step==='submitting'||e instanceof ResendRequestError&&e.uncertain?`${message} Do not retry this campaign until the provider record is reconciled.`:message};
 }
}
