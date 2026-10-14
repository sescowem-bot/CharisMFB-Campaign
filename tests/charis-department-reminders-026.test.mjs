import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/026_charis_departments_reminders.sql');
test('all eleven Charis departments are seeded, without touching existing customer data',()=>{
 for(const slug of ['it','executive','marketing','customer_service','operations','credit','compliance','audit','finance','branch','hr'])assert.ok(sql.includes(`('${slug}'`),slug);
 assert.ok(!/DROP TABLE public\.(contacts|campaign_drafts|email_deliveries)/i.test(sql));
});
test('department assignment is restricted to administrators and verified bank staff',()=>{
 assert.match(sql,/IF NOT public\.can_manage_team\(p_org\) THEN RAISE EXCEPTION 'Only the system administrator/);
 assert.match(sql,/FROM public\.organization_members WHERE organization_id=p_org AND user_id=p_user/);
 assert.match(sql,/FOREIGN KEY\(organization_id,user_id\) REFERENCES public\.organization_members/);
});
test('reminder state updates require write access and record an audit event',()=>{
 assert.match(sql,/charis_department_can_write/);
 assert.match(sql,/department_role IN \('head','member'\)/);
 assert.match(sql,/charis_reminder_status/);
 assert.match(sql,/reminder\.status_changed/);
 assert.ok(!sql.includes('TERMII_API_KEY'));
});
test('template saving checks approved bank media rather than arbitrary links',()=>{
 const media=read('lib/campaign/approved-media.ts');
 assert.match(media,/charis_media_assets/);
 assert.match(media,/organization_id/);
 assert.match(sql,/Email image must come from the bank-approved media library/);
});
test('department and reminder UI are accessible from the Charis shell',()=>{
 const shell=read('components/workspace-shell.tsx');
 assert.match(shell,/dashboard\/departments/);
 assert.match(shell,/dashboard\/reminders/);
 assert.match(read('app/dashboard/reminders/actions.ts'),/charis_reminder_save/);
});
