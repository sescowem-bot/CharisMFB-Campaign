import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const nav=read('components/workspace-shell.tsx');
const admin=read('app/admin/page.tsx');
const ui=read('components/charis-access-matrix.tsx');
const actions=read('app/admin/access/actions.ts');
const sql=read('supabase/migrations/038_charis_admin_access_matrix.sql');
test('navigation has a single administration entry and no separate SendGrid or access-control menu',()=>{
 assert.equal((nav.match(/<NavLink href="\/admin">/g)||[]).length,1);
 assert.doesNotMatch(nav,/href="\/admin\/sendgrid"|href="\/admin\/access"|href="\/admin\/providers"/);
 assert.match(nav,/canAdmin&&/);
 assert.match(admin,/account\.owner/);
 assert.match(admin,/sections\.filter\(s=>s\.show\)/);
 assert.match(read('app/admin/providers/page.tsx'),/SendGrid connection/);
});
test('routes requiring workspace context are constructed with the bank id',()=>{
 for(const x of ['/dashboard/approvals','/dashboard/delivery','/dashboard/templates','/dashboard/contacts','/dashboard/reports'])assert.ok(nav.includes(`forBank('${x}')`),x);
 assert.match(admin,/\/dashboard\/branding\?org=\$\{org\}/);
 assert.match(read('app/admin/access/page.tsx'),/\/dashboard\/team\?org=\$\{org\}/);
});
test('staff action matrix edits primary, supplementary, custom and per-module access',()=>{
 for(const key of ['primary_role','additional_role','custom_role','override:','Use role','Allow','Deny'])assert.ok(ui.includes(key),key);
 assert.match(ui,/member\.id===currentUserId/);
 assert.match(ui,/disabled=\{pending\|\|locked\}/);
 assert.match(actions,/charis_staff_access_matrix_save/);
 assert.match(actions,/charis_role_permissions_replace/);
 assert.match(actions,/bankAccess\(\)/);
});
test('database update is additive, atomic and guards delegated access',()=>{
 assert.match(sql,/^-- CHARIS 038/);
 assert.match(sql,/BEGIN;[\s\S]*COMMIT;\s*$/);
 assert.doesNotMatch(sql,/\b(DROP TABLE|TRUNCATE TABLE|DELETE FROM public\.organization_members)\b/);
 assert.match(sql,/p_user=\(SELECT auth\.uid\(\)\)/);
 assert.match(sql,/role='super_admin'/);
 assert.match(sql,/charis_staff_roles_sync/);
 assert.match(sql,/charis_set_additional_roles/);
 assert.match(sql,/team_member_save/);
 assert.match(sql,/charis_staff_permission_set/);
 assert.match(sql,/audit_logs/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.charis_staff_access_matrix_save/);
});
