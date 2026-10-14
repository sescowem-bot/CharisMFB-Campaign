import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const source=(file)=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const sql=source('supabase/migrations/027_charis_dynamic_departments_and_delegated_access.sql');
test('Batch 1 adds only migration 027, preserving migration 026',()=>{
 assert.ok(existsSync(new URL('../supabase/migrations/026_charis_departments_reminders.sql',import.meta.url)));
 assert.doesNotMatch(sql,/INSERT INTO public\.charis_departments\(organization_id,slug,name,description\)\s*SELECT/i);
 assert.doesNotMatch(sql,/DROP TABLE public\./i);
});
test('Department names are created in app and archived without deleting historical data',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.charis_department_save/);
 assert.match(sql,/charis_has_permission\(p_org,'departments\.manage'\)/);
 assert.match(sql,/Close or move open reminders before archiving/);
 assert.match(source('components/department-management-form.tsx'),/Create department/);
 assert.doesNotMatch(source('app/dashboard/departments/page.tsx'),/departmentProfiles/);
});
test('Bank delegated access prohibits self promotion and privilege escalation',()=>{
 assert.match(sql,/p_user=\(SELECT auth\.uid\(\)\)/);
 assert.match(sql,/Cannot delegate a permission you do not hold/);
 assert.match(sql,/Only the system owner can change administrator membership/);
 assert.match(sql,/You cannot change your own membership/);
 assert.match(sql,/charis_role_permission_set/);
 assert.match(sql,/charis_set_additional_roles/);
});
test('Super Admin can create custom roles while existing bank permissions remain',()=>{
 for(const name of ['charis_access_roles','charis_staff_permissions','charis_role_permissions','charis_staff_access_roles','charis_has_permission','can_edit_campaigns','can_approve_campaigns','can_dispatch_campaigns'])assert.ok(sql.includes(name),name);
 assert.match(sql,/charis_delegated_audit_read/);
 assert.match(source('app/admin/access/page.tsx'),/RoleCreationForm/);
});
test('App always uses Charis brand and fails closed without the bank workspace',()=>{
 const layout=source('app/layout.tsx');
 assert.match(layout,/charis-premium/);
 assert.doesNotMatch(layout,/publishedSite/);
 assert.match(source('middleware.ts'),/setup-required/);
 assert.doesNotMatch(source('app/page.tsx'),/Pricing|Create account/);
 assert.doesNotMatch(source('components/public.tsx'),/Create account|Pricing|Billing/);
});
