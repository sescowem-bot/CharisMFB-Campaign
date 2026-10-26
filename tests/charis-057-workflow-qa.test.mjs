import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');

test('staff create-campaign and contacts entry points exist',()=>{
 const dashboard=read('app/dashboard/page.tsx');
 const sidebar=read('components/workspace-shell.tsx');
 assert.match(dashboard,/communications\/new/);
 assert.match(sidebar,/communications/);
 assert.ok(existsSync(new URL('app/dashboard/imports/page.tsx',root)));
 assert.ok(existsSync(new URL('app/dashboard/communications/new/page.tsx',root)));
});

test('scheduled dates use WAT and reject invalid calendar values',()=>{
 const src=read('app/dashboard/communications/actions.ts');
 assert.match(src,/raw\+':00\+01:00'/);
 assert.match(src,/toISOString\(\)\.slice\(0,16\)!==raw/);
 assert.match(src,/Date\.now\(\)\+6\*60_000/);
 assert.match(src,/CHARIS_SCHEDULING_ENABLED/);
});

test('recipient status is honest about provider acceptance, failures and uncertainty',()=>{
 const labels=read('lib/direct/delivery-view.ts');
 assert.match(labels,/Accepted by provider/);
 assert.match(labels,/Needs review/);
 assert.match(labels,/failed/);
 assert.doesNotMatch(labels,/accepted:'Delivered'/);
 const history=read('app/dashboard/communications/history/page.tsx');
 assert.match(history,/deliverySummaryText\(totals\)/);
 assert.match(history,/DirectRecipientOutcomes/);
 assert.match(read('components/direct-recipient-outcomes.tsx'),/recipientStatusLabel\(r\.status\)/);
 const action=read('app/dashboard/communications/actions.ts');
 assert.match(action,/Some messages need attention/);
 assert.match(action,/Delivery needs review before taking further action/);
});

test('due reminder data loading errors are shown, not mistaken for zero reminders',()=>{
 const page=read('app/dashboard/credit-reminders/page.tsx');
 assert.match(page,/dueDataError=Boolean\(dueError\|\|dueLoansError\|\|duePeopleError\|\|dueBalancesError\)/);
 assert.match(page,/!dueDataError&&!visibleDue\.length/);
 assert.match(page,/loanError\|\|balanceError\|\|peopleError/);
 assert.match(page,/\.formatToParts\(new Date\(\)\)/);
});

test('sending and credit automations require secrets and do not bypass audit',()=>{
 const worker=read('app/api/worker/delivery/route.ts');
 const credit=read('app/api/worker/credit-reminders/route.ts');
 const sql=read('supabase/migrations/056_charis_credit_due_rules.sql');
 assert.match(worker,/bearerMatches/);
 assert.match(credit,/bearerMatches/);
 assert.match(credit,/CHARIS_CREDIT_AUTO_SCAN_ENABLED/);
 assert.match(sql,/never automatic sending/i);
 assert.match(sql,/charis_can_view_customer/);
 assert.match(sql,/l\.status='active'/);
});

test('no duplicate imports in server routes and staff workflow changes',()=>{
 const files=['app/api/worker/delivery/route.ts','app/dashboard/communications/actions.ts','app/dashboard/communications/page.tsx','app/dashboard/communications/history/page.tsx','app/dashboard/credit-reminders/page.tsx'];
 for(const file of files){
  const imports=read(file).split('\n').filter(x=>x.trim().startsWith('import '));
  assert.equal(new Set(imports).size,imports.length,`${file} has duplicate imports`);
 }
});
