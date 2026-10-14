import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sendQueuedEmail} from '../lib/delivery/transport.ts';
const email={provider:'mailjet',key:'public-key',mailjetSecret:'private-secret',id:'c328087c-e46a-4ea4-bd3d-1109f456d151',campaignId:'4d4c8a7d-56d8-4289-9188-f26a5ff114bd',name:'Charis Bank',from:'hello@example.com',replyTo:'support@example.com',domain:'example.com',to:'customer@example.net',subject:'Bank update',html:'<p>Content</p>',unsubscribe:'https://example.com/api/email/unsubscribe?token=17f07ebd'};
test('Mailjet v3.1 sends one recipient using Basic API auth and unique delivery identity',async()=>{
 let req;
 const result=await sendQueuedEmail(email,async(url,opts)=>{req={url,opts};return Response.json({Messages:[{Status:'success',To:[{MessageID:987654321}]}]});});
 assert.equal(result.status,'accepted');assert.equal(result.message,'987654321');assert.equal(req.url,'https://api.mailjet.com/v3.1/send');
 assert.equal(req.opts.headers.Authorization,'Basic '+Buffer.from(email.key+':'+email.mailjetSecret).toString('base64'));
 const body=JSON.parse(req.opts.body);assert.equal(body.Messages.length,1);
 const message=body.Messages[0];assert.deepEqual(message.To,[{Email:email.to}]);assert.equal(message.CustomID,email.id);
 assert.equal(message.CustomCampaign,'Charis-'+email.campaignId.slice(0,24));
 assert.equal(message.DeduplicateCampaign,true);assert.equal(message.Headers['List-Unsubscribe-Post'],'List-Unsubscribe=One-Click');
});
test('Mailjet ambiguous responses never become confirmed sends',async()=>{
 const r=await sendQueuedEmail(email,async()=>Response.json({Messages:[{Status:'error'}]}));
 assert.equal(r.status,'unknown');
 const denied=await sendQueuedEmail(email,async()=>Response.json({ErrorMessage:'blocked'},{status:403}));
 assert.equal(denied.status,'failed');assert.equal(denied.reason,'provider_http_403');
});
test('Provider idempotency and rate handling',async()=>{
 const resend=await sendQueuedEmail({...email,provider:'resend'},async(url,opts)=>{
  assert.equal(opts.headers['Idempotency-Key'],'campaign-delivery/'+email.id);
  return Response.json({id:'resend-id'});
 });assert.equal(resend.status,'accepted');
 const rate=await sendQueuedEmail({...email,provider:'brevo'},async(url,opts)=>{
  assert.equal(opts.headers['api-key'],email.key);
  assert.equal(opts.headers.Authorization,undefined);
  assert.equal(opts.headers['Content-Type'],'application/json');
  return Response.json({},{status:429});
 });assert.equal(rate.status,'retry');
 const unknown=await sendQueuedEmail({...email,provider:'brevo'},async()=>{throw new Error('Network timeout');});assert.equal(unknown.status,'unknown');
});
test('Routing SQL locks quotas, suppresses unsubscribes and distinguishes marketing APIs',()=>{
 const sql=readFileSync('supabase/migrations/025_charis_multi_provider_delivery.sql','utf8');
 for(const text of ["CREATE OR REPLACE FUNCTION public.delivery_begin",'FOR UPDATE','cr.allowed_kind=r.message_kind','cr.provider=d.provider',"p_provider<>'mailjet'",'lower(q.recipient_email)=lower(d.recipient_email)', 'public.email_suppressions', 'public.charis_delivery_context', 'coalesce(q.provider,r.provider)', 'public.charis_delivery_provider_summary'])assert.ok(sql.includes(text),text);
});
test('Customer dispatch is gated and Mailjet webhooks use authenticated access',()=>{
 const worker=readFileSync('lib/delivery/worker.ts','utf8');
 assert.match(worker,/CHARIS_MULTI_PROVIDER_ENABLED/);assert.match(worker,/EMAIL_DELIVERY_ENABLED/);
 assert.match(worker,/delivery_begin/);assert.match(worker,/charis_delivery_context/);
 assert.match(worker,/processDeliveryBatch/);
 const hook=readFileSync('app/api/email/webhooks/mailjet/route.ts','utf8');
 assert.match(hook,/MAILJET_WEBHOOK_SECRET/);assert.match(hook,/timingSafeEqual/);
});
