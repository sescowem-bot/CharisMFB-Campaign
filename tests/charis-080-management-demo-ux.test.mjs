import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Provider configuration is not a main staff navigation item',()=>{
 const nav=read('components/workspace-shell.tsx');
 assert.doesNotMatch(nav,/<NavLink href="\/dashboard\/zoho-smtp"/);
 assert.doesNotMatch(nav,/<NavLink href="\/dashboard\/zeptomail"/);
 assert.match(read('app/admin/providers/page.tsx'),/href="\/dashboard\/zoho-smtp"/);
 assert.match(read('app/admin/providers/page.tsx'),/href="\/dashboard\/zeptomail"/);
});
test('Campaign reports and operations reports have independent, permission-aware navigation',()=>{
 const nav=read('components/workspace-shell.tsx');
 assert.match(nav,/href="\/dashboard\/reports"><FileText/);
 assert.match(nav,/href="\/dashboard\/insights"><Activity/);
 assert.match(read('app/admin/page.tsx'),/title:'Campaign reports'/);
 assert.match(read('app/admin/page.tsx'),/title:'Operations reports'/);
 assert.match(read('app/dashboard/reports/page.tsx'),/account.owner/);
});
test('Staff identity is accessed through profile rather than prominently showing email in navigation',()=>{
 const nav=read('components/workspace-shell.tsx');
 assert.match(nav,/<Link className="user-card" href="\/dashboard\/profile"/);
 assert.match(nav,/>My profile<\/strong>/);
 assert.doesNotMatch(nav,/>Administrator<\/small>/);
 assert.match(read('app/dashboard/profile/page.tsx'),/user.email/);
 assert.match(read('app/dashboard/profile/page.tsx'),/account.owner/);
});
test('Provider test pages are authorised administrator tools',()=>{
 const zoho=read('app/dashboard/zoho-smtp/page.tsx');
 const zepto=read('app/dashboard/zeptomail/page.tsx');
 assert.match(zoho,/!account.providerAdmin/);
 assert.match(zepto,/!account.providerAdmin/);
});
test('Credit pages focus on repayment workflows and retain essential core-ledger caution',()=>{
 const loans=read('app/dashboard/loans/page.tsx');
 const reminders=read('app/dashboard/credit-reminders/page.tsx');
 const followups=read('app/dashboard/credit-followups/page.tsx');
 assert.match(loans,/title="Loan portfolio"/);
 assert.match(loans,/not a live core-banking statement/);
 assert.match(reminders,/Customer repayment reminders/);
 assert.match(reminders,/Verify loan details/);
 assert.match(followups,/title="Loan follow-ups"/);
});
