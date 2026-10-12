import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const migration=read('supabase/migrations/016_charis_staff_invitations.sql');
const actions=read('app/dashboard/team/actions.ts');
const page=read('app/dashboard/team/page.tsx');
const invite=read('components/management-forms.tsx');
const password=read('components/set-staff-password.tsx');
test('only bank company administrators can prepare and manage invitations',()=>{
 assert.match(migration,/public\.can_manage_team\(p_org\)/);
 assert.match(migration,/ALTER TABLE public\.team_invitations ENABLE ROW LEVEL SECURITY/);
 assert.match(migration,/REVOKE ALL ON public\.team_invitations FROM public, anon, authenticated/);
 assert.match(actions,/db\.rpc\('can_manage_team'/);
 assert.match(actions,/SUPABASE_SERVICE_ROLE_KEY/);
 assert.doesNotMatch(invite,/SUPABASE_SERVICE_ROLE_KEY/);
});
test('invitations become memberships only after confirmed matching login',()=>{
 assert.match(migration,/SELECT lower\(email\),email_confirmed_at INTO v_email,v_confirmed FROM auth\.users WHERE id=v_id/);
 assert.match(migration,/IF v_email IS NULL OR v_confirmed IS NULL THEN RETURN 0/);
 assert.match(migration,/i\.email=v_email AND i\.status='pending' AND i\.expires_at>now\(\)/);
 assert.match(migration,/ON CONFLICT\(organization_id,user_id\) DO NOTHING/);
 assert.match(read('app/dashboard/layout.tsx'),/team_invitation_accept/);
});
test('staff can invite, cancel and change existing members through Charis screens',()=>{
 assert.match(page,/InviteStaffForm/);
 assert.match(invite,/Send staff invitation/);
 assert.match(invite,/Pending invitations/);
 assert.match(invite,/Cancel invite/);
 assert.match(invite,/adminCount<=1&&role!=='company_admin'/);
});
test('invited staff can establish their own password without plaintext email',()=>{
 assert.match(actions,/auth\.admin\.inviteUserByEmail/);
 assert.match(actions,/auth\/setup-password/);
 assert.match(password,/auth\.updateUser\(\{password\}\)/);
 assert.match(password,/auth\.setSession/);
 assert.doesNotMatch(actions,/password\s*:/);
});
