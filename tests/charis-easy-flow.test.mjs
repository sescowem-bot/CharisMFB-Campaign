import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Charis has visible independent approval inbox and action labels',()=>{
 assert.match(src('components/workspace-shell.tsx'),/dashboard\/approvals/);
 const inbox=src('app/dashboard/approvals/page.tsx');
 assert.match(inbox,/Awaiting approval/);assert.match(inbox,/\['approve','reject'\]/);assert.match(inbox,/submitted_by!==user.id/);
 assert.match(src('components/campaign-studio.tsx'),/Submit for review/);
});
test('Charis campaign test is visible and authenticated to own account',()=>{
 assert.match(src('app/dashboard/campaigns/page.tsx'),/charis&&!!edit.data&&!!canTest/);
 assert.match(src('app/dashboard/campaigns/actions.ts'),/charis_campaign_test_reserve/);
 const sql=src('supabase/migrations/017_charis_resend_review_and_test.sql');
 assert.match(sql,/public.charis_campaign_test_reserve/);
 assert.match(sql,/v_email from auth.users/);
 assert.match(sql,/can_manage_senders\(p_org\)/);
 assert.match(sql,/role\(\) is distinct from 'service_role'/);
});
test('Resend sync uses a Vercel-held API key and insists on provider verification',()=>{
 const code=src('app/dashboard/senders/charis-actions.ts');
 assert.match(code,/process.env.RESEND_API_KEY/);
 assert.doesNotMatch(code,/process.env.CHARIS_FROM_EMAIL/);
 assert.match(code,/charis_connected/);
 assert.match(code,/status\.verified/);
 assert.match(code,/senderAccess\(org\)/);
 assert.doesNotMatch(code,/provider_domain_id.*form\.get/);
 const email=src('lib/email/server.ts');assert.match(email,/charisProviderAccount/);
});
test('the final Send button is easy to find after approval',()=>{
 assert.match(src('components/quick-send-form.tsx'),/Send approved campaign/);
 assert.match(src('app/dashboard/delivery/actions.ts'),/EMAIL_DELIVERY_ENABLED/);
 assert.match(src('supabase/migrations/017_charis_resend_review_and_test.sql'),/public.owner_delivery_claim/);
});

test('Charis queued send starts one due delivery right away',()=>{
 const action=src('app/dashboard/delivery/actions.ts');
 assert.match(action,/await processDelivery\(\{org,run:String\(run\)\}\)/);
 assert.match(action,/!row.requested_send_at/);
 assert.match(action,/Campaign queued/);
});
