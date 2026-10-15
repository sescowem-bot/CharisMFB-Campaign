import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const migration=read('supabase/migrations/032_charis_credit_reminder_centre.sql');
const actions=read('app/dashboard/credit-reminders/actions.ts');
const page=read('app/dashboard/credit-reminders/page.tsx');
const composer=read('components/charis-credit-reminder-forms.tsx');
test('migration is additive, holds delivery and never dispatches',()=>{
 assert.match(migration,/charis_credit_delivery_holds/);
 assert.match(migration,/CHECK\(status='held'\)/);
 assert.doesNotMatch(migration,/\bDROP TABLE\b|\bTRUNCATE\b|\bDELETE FROM public\.contacts\b/i);
 assert.doesNotMatch(migration,/\bhttp_post\s*\(|\bnet\.http_post\b/i);
});
test('Credit draft enforces authorisation, core-ledger reconciliation and selected limit',()=>{
 assert.match(migration,/charis_has_permission\(p_org,'credit_reminders.create'\)/);
 assert.match(migration,/p_reconciled IS DISTINCT FROM true/);
 assert.match(migration,/array_length\(p_loans,1\)>50/);
 assert.match(migration,/charis_can_view_customer\(p_org,v_loan.contact_id\)/);
 assert.match(actions,/form\.getAll\('loans'\)/);
 assert.match(composer,/name="reconciled"/);
});
test('independent approval remains default; direct own-approval needs two capabilities',()=>{
 assert.match(migration,/DEFAULT 'independent'/);
 assert.match(migration,/credit_reminders\.approve/);
 assert.match(migration,/credit_reminders\.direct_approve/);
 assert.match(migration,/v_batch\.created_by=auth\.uid\(\) OR v_batch\.submitted_by=auth\.uid\(\)/);
});
test('held batches are revalidated and staged records cannot be sent',()=>{
 assert.match(migration,/l\.total_due-r\.amount_paid<=0/);
 assert.match(migration,/FOR UPDATE;/);
 assert.match(migration,/already held today/);
 assert.match(page,/No customer messages are dispatched/);
});
test('reminder selection and template preview are scoped and useful',()=>{
 assert.match(page,/charis_loan_balances/);
 assert.match(page,/credit_reminders\.view/);
 assert.match(composer,/Select eligible shown/);
 assert.match(composer,/creditReminderPreview/);
});
