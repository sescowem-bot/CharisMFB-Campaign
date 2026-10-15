import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const sql=read('supabase/migrations/015_charis_simplified_campaigns.sql');
test('selected email recipients are tenant-scoped, eligible and bounded',()=>{
 assert.match(sql,/public\.can_manage_contacts\(p_org\)/);
 assert.match(sql,/public\.can_edit_campaigns\(p_org\)/);
 assert.match(sql,/organization_id=p_org/g);
 assert.match(sql,/coalesce\(array_length\(p_contacts,1\),0\) not between 1 and 500/);
 assert.match(sql,/consent_status='granted'/);
 assert.match(sql,/unsubscribed_at is null/);
 assert.match(sql,/email_suppressions/);
 assert.match(sql,/public\.campaign_save\(/);
 assert.match(sql,/campaign\.recipient_selection/);
});
test('import-to-group legacy path remains guarded, new uploads require documented consent',()=>{
 assert.match(sql,/public\.import_contact_batch\(p_org,p_batch_key,p_rows\)/);
 assert.match(sql,/on conflict\(list_id,contact_id\) do nothing/);
 assert.doesNotMatch(sql,/update public\.contacts set consent_status/);
 const route=read('app/api/contacts/import/route.ts');
 assert.match(route,/charis_import_consented_batch/);
 assert.match(route,/confirmed:z.literal\(true\)/);
 assert.match(read('supabase/migrations/041_charis_documented_optin_imports.sql'),/email_suppressions/);
 assert.match(route,/contactsAccess/);
});
test('single company hides day-to-day company switching without removing protected routes',()=>{
 const shell=read('components/workspace-shell.tsx');
 const navigation=read('components/workspace-shell.tsx');
 assert.match(shell,/NavLink/);
 assert.match(shell,/SignOutForm/);
 assert.doesNotMatch(navigation,/Switch company|Pricing|Billing/);
 assert.match(read('app/dashboard/page.tsx'),/SINGLE_COMPANY_ORG_ID/);
});
test('campaign composer includes individual, group and all email recipients',()=>{
 const studio=read('components/campaign-studio.tsx');
 for(const s of ['selected','list','all','segment','RecipientPicker','selected_contacts'])assert.ok(studio.includes(s),s);
 assert.match(read('app/dashboard/campaigns/actions.ts'),/charis_campaign_save_selected/);
 assert.match(read('components/quick-send-form.tsx'),/queueAction/);
});
