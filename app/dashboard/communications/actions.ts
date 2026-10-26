'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
import {sendDirectBatch} from '@/lib/direct/dispatch';
import {directEmailReadiness,directWorkerIsHealthy} from '@/lib/direct/readiness';
import {readDirectDesign,checkDirectDesign,campaignParagraphs} from '@/lib/direct/campaign-design';
import {renderCampaign} from '@/lib/campaigns/render';
import type {EmailDesign} from '@/lib/campaign/design';
export type DirectState={error?:string;success?:string;id?:string;outcome?:'submitted'|'scheduled'|'approval'|'attention'|'unavailable'};

/** The schedule is entered explicitly in Nigeria's WAT (+01:00), not the server's timezone. */
function requestedSchedule(mode:'now'|'later',raw:string):string|null {
 if(mode==='now')return null;
 if(process.env.CHARIS_SCHEDULING_ENABLED!=='true')throw Error('Scheduled campaigns are not enabled yet.');
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw))throw Error('Select a sending date and time (Nigeria time).');
 const when=new Date(raw+':00+01:00');
 // Reject impossible calendar dates and times (JavaScript otherwise normalises 31 February).
 if(!Number.isFinite(when.getTime())||new Date(when.getTime()+60*60_000).toISOString().slice(0,16)!==raw)
  throw Error('Enter a valid date and time in Nigeria time.');
 if(when.getTime()<Date.now()+6*60_000||when.getTime()>Date.now()+30*86400_000)
  throw Error('Choose a time at least 6 minutes ahead and within 30 days.');
 return when.toISOString();
}

export async function createDirectMessage(_:DirectState,form:FormData):Promise<DirectState>{
 try{
  // A wizard step, Enter key or programmatic form submit must never send a campaign.
  if(form.get('confirmed')!=='yes'||form.get('commit_send')!=='yes')
   throw Error('Review the campaign and confirm sending before submitting.');
  const account=await currentAccount();if(!account)throw Error('Sign in to create a campaign.');
  const org=account.workspace.id,db=await supabaseServer();
  const {data:permitted,error:permissionError}=await db.rpc('charis_direct_can_send',{p_org:org});
  if(permissionError||permitted!==true)throw Error('You do not have permission to send campaigns.');
  const parsed=z.object({token:z.uuid(),subject:z.string().trim().min(3).max(180),body:z.string().trim().max(2000),channel:z.enum(['email','sms']),purpose:z.enum(['service_notice','account_update','general_notice']),product:z.enum(['general','savings','current','fixed_deposit','loans','mobile_app','other']),audience:z.enum(['selected','list','all']),mode:z.enum(['now','later'])}).parse({
   token:form.get('token'),subject:form.get('subject'),body:form.get('body'),channel:form.get('channel'),purpose:form.get('purpose'),product:form.get('product'),audience:form.get('audience'),mode:form.get('mode')
  });
  const selectedProvider=z.enum(['auto','resend','brevo','mailjet']).parse(String(form.get('send_provider')||'auto'));
  if(parsed.channel==='sms'&&selectedProvider!=='auto')throw Error('Email providers cannot send SMS.');
  const scheduledAt=requestedSchedule(parsed.mode,String(form.get('send_at')||''));
  if(scheduledAt&&!(await directWorkerIsHealthy()))throw Error('Scheduled sending is unavailable. Ask your administrator to check the delivery worker.');
  if(process.env.CHARIS_SIMPLE_SENDING_ENABLED!=='true'||process.env.EMAIL_DELIVERY_ENABLED!=='true')
   throw Error('Campaign sending is not enabled yet.');
  if(parsed.channel==='sms'&&process.env.CHARIS_CUSTOMER_SMS_ENABLED!=='true')throw Error('Customer SMS is not enabled yet.');
  if(parsed.channel==='email'){
   // Validate routing server-side without leaking admin settings to staff.
   const readiness=await directEmailReadiness(org);
   if(selectedProvider!=='auto'&&!readiness.providers.some(x=>x.provider===selectedProvider))throw Error('The selected email provider is not currently available for Charis service emails. Choose Automatic or ask your administrator.');
   if(!readiness.ready)throw Error(readiness.reason==='schema_missing'
    ?'Delivery tracking needs the latest database upgrade. Contact your administrator.'
    :'No verified service email sender is ready. Contact your administrator.');
  }
  let design:EmailDesign|null=null;
  // The validated design is the source of truth. Do not compare a separate hidden
  // text field byte-for-byte: browser and editor whitespace can legitimately differ.
  let finalBody=parsed.body;
  const designInput=String(form.get('design')||'');
  if(parsed.channel==='email'&&designInput){
   design=readDirectDesign(designInput);
   const {data:brand,error:brandError}=await db.from('organization_branding').select('display_name,website_url,postal_address,primary_color').eq('organization_id',org).maybeSingle();
   if(brandError||!brand)throw Error('Bank branding is unavailable.');
   checkDirectDesign(design,brand.website_url,parsed.subject);
   finalBody=campaignParagraphs(design);
   const images=design.blocks.filter(b=>b.type==='image').map(b=>b.url);
   if(images.length){
    const {data:media,error:mediaError}=await db.from('charis_media_assets').select('public_url').eq('organization_id',org).in('public_url',images);
    const approved=new Set((media||[]).map(x=>x.public_url));
    if(mediaError||images.some(u=>!approved.has(u)))throw Error('Use images from the bank media library only.');
   }
   // Validate the sample rendering before any recipient records are reserved.
   renderCampaign({design,subject:parsed.subject,company:brand.display_name||'Charis Microfinance Bank',address:brand.postal_address||'',color:brand.primary_color||'#40239a',contact:{first_name:'Customer',last_name:'Example'},testPreview:true});
  }
  if(parsed.channel==='sms'&&designInput)throw Error('Email layouts cannot be used for SMS.');
  if(finalBody.length<10||finalBody.length>2000||(parsed.channel==='sms'&&finalBody.length>480))
   throw Error('Enter a valid message before continuing.');
  const recipients=String(form.get('contact_ids')||'').split(',').filter(Boolean).map(id=>z.uuid().parse(id));
  const group=form.get('list_id')?z.uuid().parse(form.get('list_id')):null;
  const params={
   p_org:org,p_key:parsed.token,p_title:parsed.subject.slice(0,120),p_subject:parsed.subject,p_body:finalBody,
   p_purpose:parsed.purpose,p_product:parsed.product,p_channel:parsed.channel,p_audience:parsed.audience,
   p_contact_ids:recipients,p_list:group,p_design:design,p_scheduled_at:scheduledAt
  };
  // Legacy automatic campaigns still work before additive SQL 075 is installed.
  // Explicit provider selection is persisted atomically before queue processing.
  const {data:id,error}=selectedProvider==='auto'
   ?await db.rpc('charis_direct_create_v2',params)
   :await db.rpc('charis_direct_create_provider_075',{...params,p_provider:selectedProvider});
  if(error||!id)throw Error(error?.message||'Campaign could not be saved. No messages were sent.');
  const {data:message,error:messageError}=await db.from('charis_direct_messages').select('status,scheduled_at').eq('organization_id',org).eq('id',id).maybeSingle();
  if(messageError||!message)return {id,outcome:'attention',success:'Campaign saved. Check campaign progress before trying again.'};
  revalidatePath('/dashboard/communications');
  if(message?.status==='pending_approval')return {id,outcome:'approval',success:scheduledAt?'Scheduled campaign saved for approval.':'Campaign saved for approval.'};
  if(message?.scheduled_at&&new Date(message.scheduled_at).getTime()>Date.now())return {id,outcome:'scheduled',success:'Campaign scheduled. View Campaigns to track it.'};
  if(message?.status!=='queued')return {id,outcome:'attention',success:'Campaign saved. Check its status before sending again.'};
  try{
   const result=await sendDirectBatch(3,{org,message:id});
   if(result.outcomes.disabled)return {id,outcome:'unavailable',success:'Campaign saved. Sending is currently unavailable.'};
   const accepted=result.outcomes.accepted||0,failed=result.outcomes.failed||0,uncertain=result.outcomes.unknown||0;
   if(uncertain)return {id,outcome:'attention',success:'Campaign saved. Delivery needs review before taking further action.'};
   if(failed&&!accepted)return {id,outcome:'attention',success:'Campaign saved. Some messages need attention.'};
   return {id,outcome:failed?'attention':'submitted',success:'Campaign submitted for delivery.'};
  }catch{return {id,outcome:'attention',success:'Campaign saved. Check delivery progress before trying again.'};}
 }catch(e){return {error:e instanceof z.ZodError?'Complete the required campaign details.':e instanceof SyntaxError?'Invalid email design.':e instanceof Error?e.message:'Unable to create campaign.'};}
}
export async function approveDirectMessage(_:DirectState,form:FormData):Promise<DirectState>{
 try{const account=await currentAccount();if(!account)throw Error('Sign in first');const db=await supabaseServer();const org=account.workspace.id,id=z.uuid().parse(form.get('message_id'));
  const {error}=await db.rpc('charis_direct_approve',{p_org:org,p_id:id});if(error)throw Error(error.message);
  revalidatePath('/dashboard/communications');
  const {data:message}=await db.from('charis_direct_messages').select('scheduled_at').eq('organization_id',org).eq('id',id).maybeSingle();
  if(message?.scheduled_at&&new Date(message.scheduled_at).getTime()>Date.now())return {id,success:'Campaign approved and scheduled.'};
  try{const result=await sendDirectBatch(3,{org,message:id});
   if(result.outcomes.disabled)return {id,success:'Approved. Sending is currently disabled.'};
   if(result.outcomes.unknown)return {id,success:'Approved, but a delivery outcome needs review. Do not resubmit.'};
   return {id,success:`Approved. ${result.outcomes.accepted||0} accepted by provider; ${result.outcomes.failed||0} failed. Check delivery history.`};}
  catch{return {id,success:'Approved and queued. Review delivery status before resubmitting.'};}
 }catch(e){return {error:e instanceof Error?e.message:'Unable to approve campaign.'};}
}
export async function cancelScheduledCampaign(_:DirectState,form:FormData):Promise<DirectState>{
 try{
  const account=await currentAccount();if(!account)throw Error('Sign in first');
  const id=z.uuid().parse(form.get('message_id'));const db=await supabaseServer();
  const {error}=await db.rpc('charis_direct_cancel_scheduled',{p_org:account.workspace.id,p_id:id});
  if(error)throw Error(error.message);
  revalidatePath('/dashboard/communications');revalidatePath('/dashboard/communications/history');
  return {id,success:'Scheduled campaign cancelled.'};
 }catch(e){return {error:e instanceof Error?e.message:'Unable to cancel campaign.'};}
}
