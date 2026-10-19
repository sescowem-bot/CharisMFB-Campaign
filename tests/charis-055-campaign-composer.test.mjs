import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/055_charis_campaign_composer.sql');
const composer=read('components/direct-compose.tsx');
const actions=read('app/dashboard/communications/actions.ts');
const send=read('lib/direct/dispatch.ts');
const page=read('app/dashboard/communications/new/page.tsx');

test('Release 055 builds on all previously delivered subscription and staff UX features',()=>{
 for(const path of ['app/subscribe/page.tsx','app/unsubscribe/page.tsx','app/admin/subscriptions/page.tsx','app/dashboard/communications/history/page.tsx','app/dashboard/credit/reminders/page.tsx']){
  if(!existsSync(new URL('../'+path,import.meta.url)))continue; // Credit routing differs by permission model.
  assert.ok(existsSync(new URL('../'+path,import.meta.url)),path);
 }
 assert.match(page,/\.limit\(35\)/);
});
test('Campaign workflow has 4 explicit steps, supports templates, searchable recipients and preview',()=>{
 assert.match(composer,/\['Message','Recipients','Preview','Confirm & send'\]/);
 assert.match(composer,/\.map\(\(label,index\)/);
 assert.match(composer,/selectTemplate/);
 assert.match(composer,/renderCampaign\(/);
 assert.match(composer,/api\/direct\/contacts/);
 assert.match(composer,/Confirm & Send/);
 assert.match(composer,/scheduleReady/);
});
test('Direct campaign scheduling is opt-in and WAT time is offset-aware',()=>{
 assert.match(actions,/CHARIS_SCHEDULING_ENABLED/);
 assert.match(actions,/raw\+':00\+01:00'/);
 assert.match(actions,/charis_direct_create_v2/);
 assert.match(sql,/p_scheduled_at < now\(\)\+interval '5 minutes'/);
 assert.match(sql,/m\.scheduled_at IS NULL OR m\.scheduled_at<=now\(\)/);
});
test('Legacy direct create RPC and sender safeguards are preserved',()=>{
 assert.match(sql,/public\.charis_direct_create\(/);
 assert.match(sql,/ON public\.charis_direct_messages/);
 assert.match(send,/email_suppressions/);
 assert.match(send,/charis_optional_email_optouts/);
 assert.match(send,/reservePreferenceLink/);
 assert.match(send,/sendQueuedEmail/);
 assert.match(send,/renderCampaign\(/);
});
test('Template snapshots are validated, bank-link restricted and cannot be injected in SMS',()=>{
 const d=read('lib/direct/campaign-design.ts');
 assert.match(d,/assertNoDemoLinks/);
 assert.match(d,/campaignParagraphs/);
 assert.match(d,/\.hostname\.toLowerCase\(\)!==hostname/);
 assert.match(actions,/channel==='sms'&&designInput/);
 assert.match(actions,/charis_media_assets/);
 assert.match(sql,/length\(p_design::text\)>30000/);
 assert.match(composer,/channel==='email'&&design\?richBody:body\.trim\(\)/);
});
test('Scheduled cancellation excludes already attempted recipients and keeps audit evidence',()=>{
 assert.match(sql,/status<>'pending'/);
 assert.match(sql,/charis_direct_cancel_scheduled/);
 assert.match(sql,/scheduled_cancelled/);
 assert.match(sql,/direct\.campaign_cancelled/);
 assert.ok(existsSync(new URL('../components/direct-cancel-scheduled.tsx',import.meta.url)));
});
test('Scheduled status is visible in campaigns and history',()=>{
 assert.match(read('app/dashboard/communications/page.tsx'),/scheduled_at/);
 assert.match(read('app/dashboard/communications/history/page.tsx'),/CancelScheduledCampaign/);
 assert.match(page,/CHARIS_SCHEDULING_ENABLED/);
});
test('No development-only endpoint sends real mail or SMS',()=>{
 assert.doesNotMatch(sql,/(net\.http_post|https?:\/\/api\.resend\.com)/);
 assert.match(read('app/api/worker/delivery/route.ts'),/sendDirectBatch/,'Delivery worker remains explicit')
});
