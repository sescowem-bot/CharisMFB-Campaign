import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const src=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Release 051 is retained, including subscription and consent migrations',()=>{
 assert.equal(existsSync(new URL('../supabase/migrations/051_charis_verified_resubscription.sql',import.meta.url)),true);
 assert.equal(existsSync(new URL('../app/admin/subscriptions/page.tsx',import.meta.url)),true);
});
test('primary campaign call-to-action uses the direct-sending route, not legacy approvals',()=>{
 const dash=src('app/dashboard/page.tsx');const shell=src('components/workspace-shell.tsx');
 assert.match(dash,/Create Campaign/);assert.match(dash,/href="\/dashboard\/communications\/new"/);
 assert.match(shell,/Create Campaign/);assert.match(shell,/href="\/dashboard\/communications\/new"/);
 assert.doesNotMatch(dash,/request approval and track delivery/);
});
test('contacts import and add actions are visible to authorised managers',()=>{
 const shell=src('components/workspace-shell.tsx');const page=src('app/dashboard/contacts/page.tsx');
 assert.match(shell,/permitted\('customers\.manage'\)/);
 assert.match(shell,/Import Contacts/);assert.match(shell,/Add Contact/);
 assert.match(page,/id="new-contact"/);assert.match(page,/dashboard\/imports/);
});
test('staff navigation collapses into the agreed sections, with admin menu restricted',()=>{
 const shell=src('components/workspace-shell.tsx');
 for(const title of ['Campaigns','Contacts','Credit Operations','Workspace'])assert.ok(shell.includes(`title="${title}"`),title);
 assert.match(shell,/\{canAdmin&&<>/);
 assert.equal(existsSync(new URL('../components/sidebar-section.tsx',import.meta.url)),true);
 assert.match(src('components/nav-link.tsx'),/nav-toggle/);
});
test('onboarding is skippable and available again from Help',()=>{
 const guide=src('components/staff-getting-started.tsx');
 assert.match(guide,/localStorage\.setItem/);assert.match(guide,/Skip/);
 assert.match(src('app/dashboard/help/page.tsx'),/replay/);
});
test('read-only permissions are request-scoped, not cached across users',()=>{
 const access=src('lib/auth/direct-send-access.ts');
 assert.match(access,/from 'react'/);assert.match(access,/cache\(async/);
 assert.match(access,/charis_direct_can_send/);
});
