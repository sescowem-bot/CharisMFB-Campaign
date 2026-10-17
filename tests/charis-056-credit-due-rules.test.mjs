import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get=(f)=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const sql=get('supabase/migrations/056_charis_credit_due_rules.sql');
test('due rules default off and do not submit or send notices',()=>{
 assert.match(sql,/enabled boolean NOT NULL DEFAULT false/);
 assert.match(sql,/charis_credit_auto_generate_056/);
 assert.doesNotMatch(sql,/(sendQueuedEmail|sendBrevoLoanNotice|charis_credit_email_claim_043|campaign_enqueue)\s*\(/i);
});
test('candidate generation uses Lagos dates and outstanding balance',()=>{
 assert.match(sql,/AT TIME ZONE 'Africa\/Lagos'/);
 assert.match(sql,/l\.total_due>\(SELECT coalesce\(sum\(r\.amount\),0\)/);
 assert.match(sql,/l\.status='active'/);
 assert.match(sql,/c\.archived_at IS NULL/);
 assert.match(sql,/LIMIT \(v_rule\.max_daily-v_today_count\)/);
});
test('idempotency is loan channel offset and due date',()=>{
 assert.match(sql,/UNIQUE \(organization_id,loan_id,channel,offset_days,due_on\)/);
 assert.match(sql,/ON CONFLICT\(organization_id,loan_id,channel,offset_days,due_on\) DO NOTHING/);
});
test('staff must attest and create a batch before a suggestion is marked drafted',()=>{
 assert.match(sql,/b\.reconciled_attestation/);
 assert.match(sql,/b\.created_by=auth\.uid\(\)/);
 assert.match(sql,/public\.charis_can_view_customer/);
 assert.match(get('app/dashboard/credit-reminders/actions.ts'),/charis_credit_reminder_create/);
});
test('worker is secured, disabled unless enabled and is detection-only',()=>{
 const worker=get('app/api/worker/credit-reminders/route.ts');
 assert.match(worker,/bearerMatches/);
 assert.match(worker,/CHARIS_CREDIT_AUTO_SCAN_ENABLED/);
 assert.match(worker,/charis_credit_auto_generate_056/);
 assert.doesNotMatch(worker,/(sendBrevo|sendQueuedEmail|dispatchHeldLoanEmail)/);
});
test('credit settings and staff pages expose rules and suggestions',()=>{
 assert.match(get('app/dashboard/credit-reminders/settings/page.tsx'),/CreditAutoRuleForm/);
 assert.match(get('app/dashboard/credit-reminders/page.tsx'),/Create draft/);
 assert.match(get('components/charis-credit-reminder-forms.tsx'),/initialCandidate/);
});
