import {createHash,timingSafeEqual} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {charisOrgId} from '@/lib/bank';
import {emailServiceDb} from '@/lib/email/server';

export const dynamic='force-dynamic';
export const runtime='nodejs';

function safeSecret(a:string,b:string){
 const aa=Buffer.from(a),bb=Buffer.from(b);
 return aa.length===bb.length&&timingSafeEqual(aa,bb);
}
function first(obj:Record<string,unknown>,keys:string[]){
 for(const key of keys){const value=obj[key];if(typeof value==='string'&&value.trim())return value.trim();}
 return '';
}
function classify(raw:string){
 const value=raw.toLowerCase();
 if(value.includes('complaint')||value.includes('spam'))return 'complaint';
 if(value.includes('unsubscribe')||value==='unsub')return 'unsubscribe';
 if(value.includes('bounce'))return 'bounce';
 if(value.includes('open'))return 'open';
 if(value.includes('click'))return 'click';
 if(value.includes('sent'))return 'campaign_sent';
 if(value.includes('campaign'))return 'campaign_status';
 if(value.includes('subscribe'))return 'subscribe';
 return 'unknown';
}

export async function POST(request:NextRequest){
 const secret=process.env.ZOHO_WEBHOOK_SECRET||'';
 const supplied=request.headers.get('x-charis-zoho-webhook-secret')||'';
 if(secret.length<32||!safeSecret(secret,supplied))return NextResponse.json({error:'Unauthorized'},{status:401});
 const org=charisOrgId();
 if(!org)return NextResponse.json({error:'Service unavailable'},{status:503});
 let payload:unknown;
 try{payload=await request.json();}catch{return NextResponse.json({error:'Invalid JSON'},{status:400});}
 const rows=Array.isArray(payload)?payload:[payload];
 const db=emailServiceDb();
 let accepted=0;
 for(const item of rows){
  if(!item||typeof item!=='object'||Array.isArray(item))continue;
  const p=item as Record<string,unknown>;
  const email=first(p,['contact_email','email','Email','contactEmail']).toLowerCase();
  const rawType=first(p,['event','event_type','action','status','type']);
  const eventType=classify(rawType);
  const listKey=first(p,['listkey','list_key','listKey']);
  const campaignKey=first(p,['campaignkey','campaign_key','campaignKey']);
  const providerId=first(p,['event_id','eventid','id','request_id']);
  const eventKey=providerId||createHash('sha256').update(JSON.stringify(p)).digest('hex');
  const {error:logError}=await db.from('charis_zoho_email_events').upsert({
   organization_id:org,event_key:eventKey,event_type:eventType,email:email||null,
   zoho_list_key:listKey||null,zoho_campaign_key:campaignKey||null,payload:p,processed:false
  },{onConflict:'event_key',ignoreDuplicates:true});
  if(logError)return NextResponse.json({error:'Event could not be recorded'},{status:500});
  if(email&&['unsubscribe','bounce','complaint'].includes(eventType)){
   const {data:existing,error:readError}=await db.from('email_suppressions').select('reason').eq('organization_id',org).eq('email',email).maybeSingle();
   if(readError)return NextResponse.json({error:'Suppression check failed'},{status:500});
   const reason=eventType;
   const priority:Record<string,number>={unsubscribe:1,bounce:2,complaint:3,admin:4};
   const finalReason=existing?.reason&&priority[existing.reason]>=priority[reason]?existing.reason:reason;
   const {error:suppressionError}=await db.from('email_suppressions').upsert({organization_id:org,email,reason:finalReason},{onConflict:'organization_id,email'});
   if(suppressionError)return NextResponse.json({error:'Suppression could not be applied'},{status:500});
   await db.from('charis_zoho_email_suppressions').upsert({
    organization_id:org,email,reason:finalReason,source:'zoho_webhook',
    zoho_list_key:listKey||null,suppressed_at:new Date().toISOString()
   },{onConflict:'organization_id,email'});
   if(eventType!=='bounce'){
    await db.from('contacts').update({
     consent_status:'denied',unsubscribed_at:new Date().toISOString(),
     consent_evidence:eventType==='complaint'?'Spam complaint received from Zoho Campaigns.':'Unsubscribed through Zoho Campaigns.',
     consent_recorded_at:new Date().toISOString()
    }).eq('organization_id',org).ilike('email',email);
   }
  }
  accepted++;
 }
 return NextResponse.json({received:accepted});
}
