import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('staff tasks are not called customer reminders',()=>{
 const shell=read('components/workspace-shell.tsx');
 const tasks=read('app/dashboard/tasks/page.tsx');
 assert.match(shell,/> Loan reminders<\/NavLink>/);
 assert.match(shell,/> My tasks<\/NavLink>/);
 assert.match(shell,/> Staff alerts<\/NavLink>/);
 assert.match(tasks,/These are staff-only tasks/);
 assert.match(read('app/dashboard/reminders/page.tsx'),/redirect\(`/);
});
test('loan reminder email is bank gated, authorised and has no automatic retry',()=>{
 const action=read('app/dashboard/credit-reminders/dispatch-action.ts');
 for(const c of ['CHARIS_LOAN_EMAIL_DELIVERY_ENABLED','CHARIS_LOAN_EMAIL_POLICY_APPROVED','credit_reminders.dispatch','charis_credit_email_claim_043','charis_credit_email_finish_043'])assert.ok(action.includes(c),c);
 assert.doesNotMatch(action,/setInterval|setTimeout|retry\s*\(/i);
 const sql=read('supabase/migrations/043_charis_customer_loan_reminder_delivery.sql');
 for(const c of ["status<>'held'", "v_batch.status<>'held'", 'v_amount<=0','email_suppressions','credit_reminders.dispatch','24 hours','charis_email_routes','permission_confirmed','service_role'])assert.ok(sql.includes(c),c);
});
test('Brevo staff check has fixed recipient, cooldown and records outcome',()=>{
 const action=read('app/admin/providers/brevo-staff-action.ts');
 const sql=read('supabase/migrations/043_charis_customer_loan_reminder_delivery.sql');
 assert.match(action,/BREVO_STAFF_TEST_EMAIL/);
 assert.match(action,/charis_brevo_staff_test_reserve_043/);
 assert.match(sql,/15 minutes/);
 assert.match(sql,/charis_brevo_credit_event_043/);
 assert.match(read('app/api/email/webhooks/brevo/route.ts'),/charis_brevo_credit_event_043/);
 assert.match(action,/providerAdapter\('brevo'/);
});
test('marketing Resend is not used for loan messages',()=>{
 assert.doesNotMatch(read('app/dashboard/credit-reminders/dispatch-action.ts'),/from ['"]@?.*resend|broadcastClient|sendApprovedResendBroadcast/i);
 assert.match(read('lib/email/loan-service.ts'),/api.brevo.com\/v3\/smtp\/email/);
});
