import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/033_charis_credit_followups_notifications.sql',import.meta.url),'utf8');
const get=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
test('Migration 033 is additive, transactional and has no customer dispatch',()=>{
 assert.match(sql,/\bBEGIN;[\s\S]*COMMIT;\s*$/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.charis_credit_followups/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.charis_staff_notifications/);
 assert.doesNotMatch(sql,/\b(DROP TABLE|TRUNCATE|DELETE FROM public\.contacts|http_post|send_email|send_sms)\b/i);
});
test('Follow-up access is restricted by customer scope and owner/assignee permissions',()=>{
 assert.match(sql,/CREATE POLICY charis_credit_followups_read_033[\s\S]*?charis_can_view_customer/);
 assert.match(sql,/assigned_to=\(SELECT auth\.uid\(\)\)/);
 assert.match(sql,/charis_followup_assignee_in_scope/);
 assert.match(sql,/credit_followups\.manage/);
});
test('New mutation endpoints are RPC-backed and audit changes',()=>{
 assert.match(sql,/public\.charis_credit_followup_create/);
 assert.match(sql,/public\.charis_credit_followup_status/);
 assert.match(sql,/credit\.followup_created/);
 assert.match(sql,/credit\.followup_status/);
 assert.match(get('../app/dashboard/credit-followups/actions.ts'),/db\.rpc\('charis_credit_followup_create'/);
 assert.match(get('../app/dashboard/credit-followups/actions.ts'),/db\.rpc\('charis_credit_followup_status'/);
});
test('In-app notifications are recipient-only and no customer PII is embedded',()=>{
 assert.match(sql,/CREATE POLICY charis_staff_notifications_own_033[\s\S]*?recipient_id=\(SELECT auth\.uid\(\)\)/);
 assert.match(sql,/public\.charis_staff_notification_read/);
 assert.doesNotMatch(sql,/INSERT INTO public\.charis_staff_notifications[\s\S]{0,400}loan_reference/i);
 assert.match(get('../app/dashboard/notifications/page.tsx'),/\.eq\('recipient_id',account\.id\)/);
});
test('Customer filters preserve RLS-scoped pagination and consent separation',()=>{
 const page=get('../app/dashboard/customers/page.tsx');
 assert.match(page,/\.eq\('organization_id',org\)/);
 assert.match(page,/\.eq\('consent_status',selectedConsent\)/);
 assert.match(page,/\.not\('phone','is',null\)/);
 assert.match(page,/const link=\(p:number\)/);
 assert.match(page,/Customer contact information does not establish promotional consent/);
});
