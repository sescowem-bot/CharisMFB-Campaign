import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/060_charis_direct_delivery_integrity.sql');

test('new provider events require service role and preserve verified event ledger',()=>{
 assert.match(sql,/auth\.role\(\)<>\s*'service_role'/);
 assert.match(sql,/UNIQUE\(provider,event_key\)/);
 assert.match(sql,/ON CONFLICT\(provider,event_key\) DO NOTHING/);
 assert.match(sql,/charis_direct_events_match_060/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
});
test('webhook and reconciliation support provider acknowledgments that arrive later',()=>{
 assert.match(sql,/charis_direct_reconcile_060/);
 assert.match(sql,/FOR ev IN SELECT provider,event_key/);
 const routes=['resend','brevo','mailjet'];
 routes.forEach(provider=>assert.match(read(`app/api/email/webhooks/${provider}/route.ts`),/recordProviderEvent/));
 assert.match(read('lib/direct/dispatch.ts'),/charis_direct_reconcile_060/);
});
test('old delivery models and credit reminder webhook still receive provider events',()=>{
 const src=read('lib/delivery/record-events.ts');
 assert.match(src,/db\.rpc\('delivery_event'/);
 assert.match(src,/db\.rpc\('charis_direct_event_060'/);
 assert.match(src,/charis_brevo_credit_event_043/);
});
test('webhook terminal states do not get reverted by delivery events',()=>{
 assert.match(sql,/status IN \('accepted','unknown'\)/);
 assert.match(sql,/status NOT IN \('bounced','complained','blocked','unsubscribed'\)/);
 assert.match(sql,/consent_recorded_at>p_time/);
 assert.match(sql,/WHERE excluded\.reason IN \('bounce','complaint','blocked'\)/);
});
test('sender preflight uses the same service-only eligibility routine as dispatcher',()=>{
 const f=read('lib/direct/readiness.ts');
 assert.match(f,/from\('charis_direct_provider_prefs'\)/);
 assert.match(f,/from\('sender_identities'\)/);
 assert.match(f,/from\('sending_domains'\)/);
 assert.match(f,/from\('email_provider_settings'\)/);
 assert.match(f,/from\('charis_direct_delivery_events_060'\)/);
 assert.match(read('lib/direct/dispatch.ts'),/directEmailReadiness/);
 assert.match(read('app/dashboard/communications/actions.ts'),/directEmailReadiness/);
});
test('scheduled campaigns are gated by confirmed worker activity',()=>{
 assert.match(read('app/dashboard/communications/actions.ts'),/directWorkerIsHealthy/);
 assert.match(read('app/dashboard/communications/new/page.tsx'),/schedulingReady/);
 assert.match(read('app/api/worker/delivery/route.ts'),/charis_worker_heartbeat_060/);
 assert.match(sql,/last_success_at/);
});
test('status labels separate provider acknowledgment and final delivery',()=>{
 const v=read('lib/direct/delivery-view.ts');
 assert.match(v,/accepted:'Accepted by provider'/);
 assert.match(v,/delivered:'Delivered'/);
 assert.match(v,/bounced:'Bounced'/);
});
