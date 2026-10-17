import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Resubscribe is confirmed by mailbox owner, never administrator',()=>{
 const sql=src('supabase/migrations/051_charis_verified_resubscription.sql');
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.charis_subscription_confirm/);
 assert.match(sql,/WHERE token_hash=p_hash FOR UPDATE/);
 assert.match(sql,/IF r\.expires_at<v_now THEN RETURN 'expired'/);
 assert.match(sql,/consent_evidence='Verified customer email resubscription request/);
 assert.match(sql,/DELETE FROM public\.email_suppressions WHERE organization_id=r\.organization_id AND email=r\.email AND reason='unsubscribe'/);
 assert.match(sql,/s\.reason <> 'unsubscribe'/);
});
test('Resubscription request is rate limited and generic externally',()=>{
 const sql=src('supabase/migrations/051_charis_verified_resubscription.sql');
 assert.match(sql,/interval '30 minutes'/);assert.match(sql,/interval '24 hours'/);
 const route=src('app/api/preferences/resubscribe/request/route.ts');
 assert.match(route,/subscribe\/complete\?request=1/);
 assert.doesNotMatch(route,/JSON\.stringify\(\{email/);
});
test('Role assignment requires bank administrator and membership',()=>{
 const sql=src('supabase/migrations/051_charis_verified_resubscription.sql');
 assert.match(sql,/IF NOT public\.charis_direct_is_admin\(p_org\)/);
 assert.match(sql,/FROM public\.organization_members WHERE organization_id=p_org AND user_id=p_user/);
 assert.match(sql,/subscription\.staff_access_changed/);
});
test('Old unsubscribe sync is superseded by latest consent revision',()=>{
 const sql=src('supabase/migrations/051_charis_verified_resubscription.sql');
 assert.match(sql,/revision=public\.charis_subscription_sync\.revision\+1/);
 const sync=src('lib/preferences/sync.ts');
 assert.match(sync,/\.eq\('revision',row\.revision\)/);
 assert.match(sync,/unsubscribed:row\.desired_unsubscribed/);
 const route=src('app/api/worker/delivery/route.ts');
 assert.match(route,/retryPendingResendOptouts/);
});
test('Confirmation is POST and no confirmation on email link GET',()=>{
 const page=src('app/subscribe/confirm/page.tsx');
 assert.match(page,/method="post"/);
 assert.match(page,/inspectResubscribeToken/);
 const api=src('app/api/preferences/resubscribe/confirm/route.ts');
 assert.match(api,/export async function POST/);
 assert.doesNotMatch(api,/export async function GET/);
});
