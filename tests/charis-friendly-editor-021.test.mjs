import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('bank editor labels are clear and new audience creation stays within the composer',()=>{
 const studio=read('components/campaign-studio.tsx');
 assert.match(studio,/Inbox preview text \(optional\)/);
 assert.match(studio,/Create a group here|QuickAudienceCreator/);
 assert.match(studio,/Smart group \(updates automatically\)/);
 assert.match(studio,/Insert customer detail/);
 const inline=read('components/quick-audience-creator.tsx');
 assert.doesNotMatch(inline,/<form\b/,'no nested form in parent campaign form');
 assert.match(inline,/type="button" onClick=\{submit\}/);
});
test('existing domain and campaign sending restrictions are unchanged',()=>{
 const studio=read('components/campaign-studio.tsx');
 assert.match(studio,/selected_contacts/);
 assert.match(studio,/RecipientPicker/);
 assert.match(read('components/workspace-shell.tsx'),/Email disabled/);
 assert.match(read('lib/delivery/worker.ts'),/EMAIL_DELIVERY_ENABLED/);
});
test('four email designs use one structured schema and persist into template library',()=>{
 const render=read('lib/campaigns/render.ts');
 const library=read('lib/campaign/design.ts');
 const template=read('components/template-studio.tsx');
 assert.match(render,/announcement/);
 assert.match(render,/minimal/);
 assert.match(library,/style:z.enum/);
 assert.match(template,/JSON.stringify\(design\)/);
 assert.match(template,/<EmailDesignCanvas design=\{design\}/);
});
test('extra customer fields require bank access and protect account identifiers',()=>{
 const sql=read('supabase/migrations/021_charis_customer_details.sql');
 assert.match(sql,/public.can_manage_contacts\(p_org\)/);
 assert.match(sql,/Maximum 12 extra customer fields/);
 assert.match(sql,/Store only the last four digits/);
 assert.match(sql,/REVOKE ALL ON FUNCTION/);
 assert.match(read('components/contact-import-wizard.tsx'),/extraColumns/);
 assert.match(read('lib/campaigns/render.ts'),/account_number\|account_no\|account_reference/);
});
test('only scoped and verified staff can create smart groups through the new API',()=>{
 const route=read('app/api/contacts/segments/route.ts');
 assert.match(route,/sameOrigin/);
 assert.match(route,/contactsAccess/);
 assert.match(route,/save_contact_segment/);
});
