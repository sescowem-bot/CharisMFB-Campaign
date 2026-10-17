import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('the direct composer loads no more than 35 recent contacts',()=>{
 const s=read('app/dashboard/communications/new/page.tsx');
 assert.match(s,/\.limit\(35\)/);
 assert.doesNotMatch(s,/\.limit\(250\)/);
});
test('contact directory searches are debounced, cancellable and remain permission guarded',()=>{
 const s=read('components/direct-compose.tsx'),api=read('app/api/direct/contacts/route.ts');
 assert.match(s,/AbortController/);
 assert.match(s,/setTimeout\(async/);
 assert.match(s,/controller\.abort\(\)/);
 assert.match(s,/\.length<2/);
 assert.match(s,/\.slice\(0,40\)/);
 assert.match(api,/charis_direct_can_send/);
 assert.match(api,/\.eq\('organization_id',org\)/);
 assert.match(api,/\.limit\(40\)/);
});
test('selection survives a changed search query',()=>{
 const s=read('components/direct-compose.tsx');
 assert.match(s,/selectedDetails/);
 assert.match(s,/chosen\.map\(id=>/);
 assert.match(s,/setChosen\(old=>old\.filter/);
 assert.match(s,/direct-selection-summary/);
});
test('staff navigation avoids additional organisation redirects',()=>{
 const shell=read('components/workspace-shell.tsx');const home=read('app/dashboard/page.tsx');const middleware=read('middleware.ts');
 assert.match(shell,/forBank=\(path:string\)=>path/);
 assert.match(home,/extra\?`\$\{path\}\?/);
 assert.match(middleware,/internal\.searchParams\.set\('org',org\)/);
});
test('loan reminder history is paginated and lazy; only selected batch fetches recipients',()=>{
 const main=read('app/dashboard/credit-reminders/page.tsx');
 const detail=read('app/dashboard/credit-reminders/[id]/page.tsx');
 assert.match(main,/historySize=12/);
 assert.match(main,/View reminder/);
 assert.doesNotMatch(main,/charis_credit_reminder_items/);
 assert.doesNotMatch(main,/charis_credit_delivery_holds/);
 assert.doesNotMatch(main,/charis_credit_email_dispatches/);
 for(const table of ['charis_credit_reminder_items','charis_credit_delivery_holds','charis_credit_email_dispatches'])assert.match(detail,new RegExp(table));
 assert.match(detail,/credit_reminders\.view/);
 assert.match(detail,/charis_credit_email_dispatches/);
 assert.match(detail,/\.eq\('organization_id',org\)/);
 assert.match(detail,/dispatches\|\|\[\]/);
});
test('existing bank delivery gates and previous releases remain intact',()=>{
 for(const p of ['supabase/migrations/051_charis_verified_resubscription.sql','app/admin/subscriptions/page.tsx','components/sidebar-section.tsx','components/staff-getting-started.tsx'])assert.ok(existsSync(new URL('../'+p,import.meta.url)),p);
 const dispatch=read('app/dashboard/credit-reminders/dispatch-action.ts');
 assert.match(dispatch,/CHARIS_LOAN_EMAIL_DELIVERY_ENABLED/);
 assert.match(dispatch,/CHARIS_LOAN_EMAIL_POLICY_APPROVED/);
 assert.match(dispatch,/charis_credit_email_claim_043/);
});
test('mobile touch targets and layouts remain accessible',()=>{
 const css=read('app/globals.css');
 assert.match(css,/\.direct-contact-row\{min-height:48px\}/);
 assert.match(css,/\.direct-selection-chip\{min-height:40px/);
 assert.match(css,/@media\(max-width:640px\)/);
});
