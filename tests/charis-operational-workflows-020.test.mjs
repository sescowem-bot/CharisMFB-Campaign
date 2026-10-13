import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const sql=read('supabase/migrations/020_charis_operational_workflows.sql');
test('extra roles are scoped and do not grant company administrator',()=>{
 for(const x of ['charis_additional_roles','charis_set_additional_roles','can_edit_campaigns','can_approve_campaigns','can_dispatch_campaigns','can_manage_contacts','ENABLE ROW LEVEL SECURITY','can_manage_team']) assert.ok(sql.includes(x),x);
 assert.match(sql,/Company administrator is a primary role only/);
 assert.match(sql,/FOREIGN KEY\(organization_id,user_id\)/);
});
test('batch customer operations preserve tenant permission and guarded deletion',()=>{
 for(const x of ['charis_bulk_contacts','can_manage_contacts','charis_contact_archive','charis_contact_delete','charis_list_batch','ON CONFLICT(list_id,contact_id)'])assert.ok(sql.includes(x),x);
 assert.ok(read('components/customer-table.tsx').includes('Archive selected'));
 assert.ok(read('components/bulk-list-manager.tsx').includes('Add selected to group'));
});
test('testing only permits a verified member and never changes marketing eligibility',()=>{
 assert.match(sql,/charis_campaign_test_reserve_to/);
 assert.match(sql,/email_confirmed_at IS NOT NULL/);
 assert.match(sql,/charis_campaign_test_reserve\(p_org,p_campaign,p_revision\)/);
 assert.doesNotMatch(sql,/UPDATE public.contacts SET consent_status='granted'/i);
 assert.match(read('components/campaign-studio.tsx'),/Test recipient email/);
});
test('templates, audiences and approvals have clear navigation',()=>{
 assert.match(read('app/dashboard/templates/page.tsx'),/Create a new template/);
 assert.match(read('app/dashboard/segments/page.tsx'),/&segment=\$\{s.id\}/);
 assert.match(read('app/dashboard/lists/page.tsx'),/&list=\$\{l.id\}/);
 assert.match(read('app/dashboard/approvals/page.tsx'),/Drafts do not enter the approval inbox/);
 assert.match(read('app/dashboard/campaigns/page.tsx'),/still a draft/);
});
test('SQL migration is additive and follows 019',()=>{
 assert.ok(existsSync(new URL('supabase/migrations/019_charis_dashboard_and_campaign_lead.sql',root)));
 assert.ok(sql.trim().startsWith('-- 020'));
 assert.doesNotMatch(sql,/drop\s+table|truncate\s+table|delete\s+from\s+public\.campaign_drafts/i);
});
