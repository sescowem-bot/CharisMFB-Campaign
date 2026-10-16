import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('047 is an additive migration retaining legacy marketing and credit paths',()=>{
 const s=read('supabase/migrations/047_charis_simple_communications.sql');
 assert.match(s,/CREATE TABLE IF NOT EXISTS public\.charis_direct_messages/);
 assert.match(s,/CREATE TABLE IF NOT EXISTS public\.charis_direct_recipients/);
 assert.match(s,/approval_required boolean NOT NULL DEFAULT false/);
 assert.doesNotMatch(s,/\bDROP TABLE\b|\bTRUNCATE\b|\bDELETE FROM public\.contacts\b/i);
});
test('staff authorisation honors explicit restrictions and customer scope',()=>{
 const s=read('supabase/migrations/047_charis_simple_communications.sql');
 assert.match(s,/charis_direct_can_send\(p_org uuid\)/);
 assert.match(s,/NOT r\.can_send/);
 assert.match(s,/public\.charis_can_view_customer\(p_org,c\.id\)/);
 assert.match(s,/idempotency_key uuid NOT NULL/);
});
test('promotion requests blocked from transactional notice workflow',()=>{
 const s=read('supabase/migrations/047_charis_simple_communications.sql');
 assert.match(s,/p_purpose NOT IN \('service_notice','account_update','general_notice'\)/);
 assert.match(s,/Marketing workflow for promotions/);
});
test('dispatch blocks on unknown provider outcomes and prevents unsafe replay',()=>{
 const s=read('lib/direct/dispatch.ts');
 assert.match(s,/sendQueuedEmail/);
 assert.match(s,/if\(status==='unknown'\)break/);
 assert.match(s,/charis_direct_claim/);
 assert.match(s,/charis_direct_finish/);
 const sql=read('supabase/migrations/047_charis_simple_communications.sql');
 assert.match(sql,/FOR UPDATE OF r SKIP LOCKED/);
 assert.match(sql,/status='paused'/);
});
test('simple composer has recipient, message and submission fields',()=>{
 const s=read('components/direct-compose.tsx');
 for(const name of ['name="title"','name="subject"','name="purpose"','name="audience"','name="channel"','name="contact_ids"'])assert.ok(s.includes(name),name);
 assert.match(s,/Send now/);
});
test('worker endpoint includes direct delivery independently of legacy worker flag',()=>{
 const s=read('app/api/worker/delivery/route.ts');
 assert.match(s,/sendDirectBatch/);assert.match(s,/CHARIS_MULTI_PROVIDER_ENABLED/);
});

test('direct staff action requires enabling sending and service sender preflight',()=>{
 const s=read('app/dashboard/communications/actions.ts');
 assert.match(s,/CHARIS_SIMPLE_SENDING_ENABLED/);assert.match(s,/EMAIL_DELIVERY_ENABLED/);assert.match(s,/charis_direct_provider_prefs/);assert.match(s,/charis_direct_create/);
});
test('directory search verifies authentication and communication permission',()=>{
 const s=read('app/api/direct/contacts/route.ts');
 assert.match(s,/currentAccount/);assert.match(s,/charis_direct_can_send/);assert.match(s,/no-store/);
});
