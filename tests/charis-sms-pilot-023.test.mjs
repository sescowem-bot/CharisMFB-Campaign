import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
test('sms pilot never offers customer delivery',()=>{
 const page=read('app/dashboard/sms/page.tsx');
 assert.match(page,/Customer SMS dispatch is not enabled/);
 assert.doesNotMatch(page,/charis_sms_dispatch|api\/sms\/broadcast/);
});
test('SMS review requires a different creator and approver in database',()=>{
 const sql=read('supabase/migrations/023_charis_sms_pilot.sql');
 assert.match(sql,/auth\.uid\(\) IN \(r\.edited_by,r\.submitted_by\)/);
 assert.match(sql,/can_approve_campaigns/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/interval '60 seconds'/);
 assert.match(sql,/interval '1 day'/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.charis_sms_test_finish\(uuid,uuid,uuid,text,text\) TO service_role/);
});
test('sms tests only use a server configured number and key',()=>{
 const src=read('lib/sms/termii.ts');
 assert.match(src,/process\.env\.CHARIS_SMS_TEST_NUMBER/);
 assert.match(src,/process\.env\.TERMII_API_KEY/);
 assert.doesNotMatch(src,/NEXT_PUBLIC_TERMII/);
 assert.match(src,/AbortSignal\.timeout/);
});
test('SMS navigation is added once and documentation lives in MD',()=>{
 const nav=read('components/charis-navigation.tsx');
 assert.equal((nav.match(/label:'SMS communications'/g)||[]).length,1);
 const doc=read('MD/SMS_AND_SENDGRID.md');
 assert.match(doc,/no ability to send SMS to customers/i);
});
