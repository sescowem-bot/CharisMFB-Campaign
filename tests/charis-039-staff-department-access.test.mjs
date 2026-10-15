import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
test('staff access presents department membership and module actions, not only role checkboxes',()=>{
 const src=read('components/charis-access-matrix.tsx');
 assert.match(src,/Department membership/);
 assert.match(src,/What this staff member can do/);
 assert.match(src,/name=\{`department:\$\{d\.id\}`\}/);
 assert.match(src,/value=\{overrides\[p\.permission_key\]\|\|'inherit'\}/);
});
test('server sends scoped department membership alongside staff roles',()=>{
 const src=read('app/admin/access/actions.ts');
 assert.match(src,/charis_staff_profile_save/);
 assert.match(src,/p_departments:departmentChanges/);
 assert.match(src,/const org=z\.string\(\)\.uuid\(\)\.parse\(process\.env\.SINGLE_COMPANY_ORG_ID\)/);
});
test('department assignment form is shown before department directory cards',()=>{
 const src=read('app/dashboard/departments/page.tsx');
 assert(src.indexOf('<DepartmentAssignmentForm') < src.indexOf('<div className="charis-dept-grid">'));
 assert.match(src,/staffResult\.error\|\|members\.error/);
});
test('database procedure protects existing memberships and requires role-level access',()=>{
 const src=read('supabase/migrations/039_charis_staff_departments_and_actions.sql');
 assert.match(src,/p_departments jsonb DEFAULT NULL/);
 assert.match(src,/public\.charis_staff_access_matrix_save/);
 assert.match(src,/departments\.manage/);
 assert.match(src,/public\.is_platform_super_admin\(\)/);
 assert.doesNotMatch(src,/(?:DROP\s+TABLE|TRUNCATE|DELETE\s+FROM\s+public\.contacts)/i);
});
