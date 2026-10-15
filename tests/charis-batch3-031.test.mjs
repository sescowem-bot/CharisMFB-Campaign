import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const sql=read('supabase/migrations/031_charis_loan_register.sql');
test('031 is additive and never enables customer dispatch',()=>{
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.charis_loans/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.charis_loan_repayments/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.charis_service_notices/);
 assert.doesNotMatch(sql,/\bDROP TABLE\b|\bTRUNCATE\b|\bALTER TABLE public\.contacts DROP\b/i);
 assert.doesNotMatch(sql,/\b(email_delivery_enabled|charis_multi_provider_enabled)\s*=\s*true/i);
});
test('credit tables are read-only for staff and scoped by customer RLS',()=>{
 assert.match(sql,/REVOKE ALL ON public\.charis_loans,public\.charis_loan_repayments FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/CREATE POLICY charis_loans_read_031/);
 assert.match(sql,/public\.charis_can_view_customer\(p_org,p_contact\)/);
 assert.match(sql,/public\.charis_has_permission\(p_org,'loans\.manage'\)/);
});
test('loan balance calculation uses full security-invoker view and duplicate receipt prevention',()=>{
 assert.match(sql,/VIEW public\.charis_loan_balances WITH \(security_invoker=true\)/);
 assert.match(sql,/UNIQUE\(organization_id,loan_id,receipt_reference\)/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/Payment exceeds the outstanding loan balance/);
 assert.match(read('app/dashboard/loans/page.tsx'),/from\('charis_loan_balances'\)/);
});
test('service draft, edit, submit and independent review never call customer sending',()=>{
 assert.match(sql,/status IN \('draft','submitted','approved','rejected'\)/);
 assert.match(sql,/v_row\.submitted_by=auth\.uid\(\) OR v_row\.created_by=auth\.uid\(\)/);
 assert.match(sql,/charis_service_notice_update/);
 assert.match(sql,/charis_service_notice_review/);
 assert.match(read('app/dashboard/communications/service/actions.ts'),/charis_service_notice_create/);
 assert.doesNotMatch(read('app/dashboard/communications/service/actions.ts'),/\/api\/email\/send|\/api\/sms\/send|fetch\(/);
});
test('sidebar gives credit and service notice actions only to permitted staff',()=>{
 const src=read('components/workspace-shell.tsx');
 assert.match(src,/canAny\('loans\.view','loans\.manage'/);
 assert.match(read('app/dashboard/communications/page.tsx'),/service_notices\.view/);
 assert.match(read('app/dashboard/communications/service/page.tsx'),/service_notices\.view/);
});
