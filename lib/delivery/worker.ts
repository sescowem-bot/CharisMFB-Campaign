import 'server-only';
import {emailServiceDb,refreshDomain} from '@/lib/email/server';
import {renderCampaign,type PreviewContact} from '@/lib/campaigns/render';
import {sendQueuedEmail} from './transport';
import {z} from 'zod';
import {mailbox} from '@/lib/email/validation';
import {providerAdapter} from '@/lib/email/providers';

const claimSchema=z.object({delivery:z.object({id:z.string().uuid(),organization_id:z.string().uuid(),lease_token:z.string().uuid()})});
const dispatchContext=z.object({
 delivery:z.object({id:z.string().uuid(),organization_id:z.string().uuid(),lease_token:z.string().uuid(),recipient_email:z.string().email(),recipient:z.custom<PreviewContact>(),unsubscribe_token:z.string().uuid(),provider:z.enum(['resend','brevo','mailjet'])}),
 run:z.object({id:z.string().uuid(),message_kind:z.enum(['marketing','service']).optional(),snapshot:z.object({campaign:z.object({design:z.unknown(),subject:z.string(),preheader:z.string().nullable().optional()}),brand:z.object({display_name:z.string(),postal_address:z.string(),primary_color:z.string()})})}),
 sender:z.object({id:z.string().uuid(),domain_id:z.string().uuid(),from_name:z.string(),from_email:z.string(),reply_to:z.string()}),
 domain:z.object({id:z.string().uuid(),provider:z.enum(['resend','brevo','mailjet'])})
});

/** One worker request reserves and sends at most one contact. Do not auto-retry unknown submissions. */
export async function processDelivery(scope?:{org:string;run:string}) {
 if(process.env.EMAIL_DELIVERY_ENABLED!=='true'||process.env.CHARIS_MULTI_PROVIDER_ENABLED!=='true')return {result:'disabled'};
 const url=process.env.NEXT_PUBLIC_APP_URL;if(!url)throw new Error('Public application URL is missing');
 const origin=new URL(url);if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('Public application URL must be an HTTPS origin');
 const db=emailServiceDb();
 if(!scope){const {error:recovery}=await db.rpc('delivery_recover');if(recovery)throw new Error('Lease recovery failed');}
 const {data:claim,error:claimed}=scope?
  await db.rpc('owner_delivery_claim',{p_org:z.string().uuid().parse(scope.org),p_run:z.string().uuid().parse(scope.run)}):
  await db.rpc('delivery_claim');
 if(claimed)throw new Error('Queue claim failed');if(!claim)return {result:'idle'};
 const parsed=claimSchema.safeParse(claim);if(!parsed.success)throw new Error('Invalid queue lease');
 const d=parsed.data.delivery;
 const {data:decision,error:begin}=await db.rpc('delivery_begin',{p_id:d.id,p_lease:d.lease_token});
 if(begin)throw new Error('Delivery reservation failed');if(decision!=='dispatch')return {result:String(decision)};
 let ctx:z.infer<typeof dispatchContext>;
 try{
  const {data,error}=await db.rpc('charis_delivery_context',{p_id:d.id,p_lease:d.lease_token});
  if(error)throw error;
  ctx=dispatchContext.parse(data);
  if(ctx.delivery.provider!==ctx.domain.provider)throw new Error('Provider sender mismatch');
  // Resend promotional traffic must use its Broadcast API, never /emails.
  if(ctx.delivery.provider==='resend'&&ctx.run.message_kind!=='service')throw new Error('Resend marketing requires Broadcasts, not transactional delivery');
 }catch{
  const {error}=await db.rpc('delivery_finish',{p_id:d.id,p_lease:d.lease_token,p_status:'failed',p_message:null,p_reason:'dispatch_context_invalid'});
  if(error)throw new Error('Delivery context could not be reconciled');
  return {result:'paused'};
 }
 const {delivery,run,sender,domain}=ctx;
 let subject:string,html:string;
 let key:string;
 try{
  const envKey=delivery.provider==='resend'?'RESEND_API_KEY':delivery.provider==='brevo'?'BREVO_API_KEY':'MAILJET_API_KEY';
  key=process.env[envKey]||'';
  if(!key||(delivery.provider==='mailjet'&&!process.env.MAILJET_SECRET_KEY))throw new Error('Provider credentials unavailable');
  const checked=await refreshDomain(delivery.organization_id,domain.id);
  if(!checked.verified)throw new Error('Sender verification failed');
  if(delivery.provider==='mailjet')await providerAdapter('mailjet',key).findVerifiedMailjetSender(sender.from_email);
  if(delivery.provider==='brevo')await providerAdapter('brevo',key).findVerifiedBrevoSender(sender.from_email);
  const unsubscribe=new URL('/api/email/unsubscribe',origin);unsubscribe.searchParams.set('token',delivery.unsubscribe_token);
  const rendered=renderCampaign({design:run.snapshot.campaign.design,subject:run.snapshot.campaign.subject,preheader:run.snapshot.campaign.preheader||'',company:run.snapshot.brand.display_name,address:run.snapshot.brand.postal_address,color:run.snapshot.brand.primary_color,contact:delivery.recipient,unsubscribeUrl:unsubscribe.href});
  subject=rendered.subject;html=rendered.html;
 }catch{
  const {error:finish}=await db.rpc('delivery_finish',{p_id:d.id,p_lease:d.lease_token,p_status:'failed',p_message:null,p_reason:'pre_dispatch_configuration_failed'});
  if(finish)throw new Error('Preparation failure could not be recorded');
  await db.from('campaign_runs').update({status:'paused',last_error:'Sender or provider preparation failed. Review before resuming.'}).eq('id',run.id).in('status',['queued','running']);
  return {result:'paused'};
 }
 const unsubscribe=new URL('/api/email/unsubscribe',origin);unsubscribe.searchParams.set('token',delivery.unsubscribe_token);
 let result;
 try{
  result=await sendQueuedEmail({provider:delivery.provider,key,mailjetSecret:process.env.MAILJET_SECRET_KEY,campaignId:run.id,id:d.id,name:sender.from_name,from:sender.from_email,replyTo:sender.reply_to,domain:mailbox(sender.from_email).split('@')[1],to:delivery.recipient_email,subject,html,unsubscribe:unsubscribe.href});
 }catch {result={status:'failed' as const,reason:'invalid_dispatch_content'};}
 const {error:finish}=await db.rpc('delivery_finish',{p_id:d.id,p_lease:d.lease_token,p_status:result.status,p_message:result.message||null,p_reason:result.reason});
 if(finish)throw new Error('Delivery outcome could not be saved. Do not resend; reconcile with the provider dashboard.');
 if(result.status==='unknown'||['provider_http_401','provider_http_403','provider_http_402'].includes(result.reason))
  await db.from('campaign_runs').update({status:'paused',last_error:'Provider delivery requires manual review: '+result.reason}).eq('id',run.id).in('status',['queued','running']);
 return {result:result.status,provider:delivery.provider};
}

/** The scheduled worker drains a bounded number of ready jobs without sending concurrent copies. */
export async function processDeliveryBatch(limit=3){
 const max=Math.max(1,Math.min(20,Math.floor(limit)));
 const outcomes:Record<string,number>={};let processed=0;
 for(let i=0;i<max;i++){
  const result=await processDelivery();
  outcomes[result.result]=(outcomes[result.result]||0)+1;
  if(['idle','disabled','provider_limit','routes_not_configured','company_limit','not_ready'].includes(result.result))break;
  processed++;
 }
 return {processed,outcomes};
}
