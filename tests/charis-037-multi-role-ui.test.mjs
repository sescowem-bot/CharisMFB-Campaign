import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const text=(p)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
test('multi-role access form sends selected custom role ids',()=>{
 const ui=text('components/charis-access-forms.tsx');
 assert.match(ui,/getAll\('role_id'\)|name="role_id" value=\{r\.id\}/);
 assert.match(ui,/type="checkbox" name="role_id"/);
 assert.match(ui,/No custom roles created yet/);
 assert.match(ui,/Team Access/);
});
test('staff invitation link keeps active Charis organization context',()=>{
 const page=text('app/admin/access/page.tsx');
 assert.match(page,/href=\{`\/dashboard\/team\?org=\$\{org\}`\}/);
});
test('multi-role writes are atomic and permission checked',()=>{
 const actions=text('app/admin/access/actions.ts');
 const sql=text('supabase/migrations/037_charis_multi_custom_role_assignment.sql');
 assert.match(actions,/charis_staff_roles_sync/);
 assert.match(actions,/\.max\(30\)\.parse\(form\.getAll\('role_id'\)\)/);
 assert.match(sql,/SECURITY DEFINER SET search_path=''/);
 assert.match(sql,/charis_has_permission\(p_org,'access\.manage'\)/);
 assert.match(sql,/p_user=\(SELECT auth\.uid\(\)\)/);
 assert.match(sql,/NOT public\.charis_has_permission\(p_org,g\.permission_key\)/);
 assert.match(sql,/ON CONFLICT\(organization_id,user_id,role_id\) DO NOTHING/);
 assert.match(sql,/INSERT INTO public\.audit_logs/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.charis_staff_roles_sync/);
});
