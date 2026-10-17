import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('accepts staff invitation at sign-in or callback, not on each page navigation',()=>{
 const layout=read('app/dashboard/layout.tsx');
 const auth=read('components/auth-form.tsx');
 const callback=read('app/auth/callback/route.ts');
 assert.doesNotMatch(layout,/team_invitation_accept|auth\.getUser|supabaseServer\(/);
 assert.match(auth,/signInWithPassword/);
 assert.match(auth,/client\.rpc\('team_invitation_accept'\)/);
 assert.match(callback,/team_invitation_accept/);
});
test('sidebar does not prefetch many protected pages',()=>{
 const nav=read('components/nav-link.tsx');
 assert.match(nav,/<Link prefetch=\{false\}/);
 assert.match(nav,/aria-current=/);
});
test('existing security and request-scoped authorization remain intact',()=>{
 const shell=read('components/workspace-shell.tsx');
 const access=read('lib/auth/current-user.ts');
 const contact=read('lib/contacts/access.ts');
 const middleware=read('middleware.ts');
 assert.match(shell,/currentAccount\(\)/);
 assert.match(shell,/canSendDirect\(/);
 assert.match(access,/cache\(async/);
 assert.match(contact,/currentVerifiedUser\(\)/);
 assert.match(contact,/can_manage_contacts/);
 assert.match(middleware,/client\.auth\.getUser\(\)/);
});
test('campaign pages reuse request-cached permission result',()=>{
 for(const file of ['app/dashboard/communications/page.tsx','app/dashboard/communications/new/page.tsx']){
  assert.match(read(file),/canSendDirect\(org\)/,file);
  assert.doesNotMatch(read(file),/db\.rpc\('charis_direct_can_send'/,file);
 }
});
test('import, contacts and loans overlap independent reads',()=>{
 for(const file of ['app/dashboard/imports/page.tsx','app/dashboard/contacts/page.tsx','app/dashboard/loans/page.tsx']){
  assert.match(read(file),/Promise\.all\(\[/,file);
 }
});
test('loan reminder dashboard fetches policy and batches in the same query wave',()=>{
 const source=read('app/dashboard/credit-reminders/page.tsx');
 assert.match(source,/\[\{data:policy\},\{data:loanRows/);
 assert.match(source,/\[\{data:balances,error:balanceError\},\{data:people\}\]/);
 assert.doesNotMatch(source,/charis_credit_delivery_holds/);
 assert.match(source,/historySize=12/);
});
test('lightweight responsive route loading state respects reduced motion',()=>{
 assert.ok(existsSync(new URL('../app/dashboard/loading.tsx',import.meta.url)));
 assert.match(read('app/dashboard/loading.tsx'),/role="status"/);
 assert.match(read('app/globals.css'),/prefers-reduced-motion/);
});
test('Release 051 preferences and Release 052 tour are retained',()=>{
 for(const file of ['supabase/migrations/051_charis_verified_resubscription.sql','components/staff-getting-started.tsx','app/admin/subscriptions/page.tsx','components/sidebar-section.tsx']){
  assert.ok(existsSync(new URL('../'+file,import.meta.url)),file);
 }
});
