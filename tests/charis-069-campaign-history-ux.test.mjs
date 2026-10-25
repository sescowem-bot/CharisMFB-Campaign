import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Main campaign view provides status counts, search, filters and details without bypassing RLS',()=>{
 const page=read('app/dashboard/communications/page.tsx');
 const ui=read('components/direct-delivery-history.tsx');
 assert.match(page,/currentAccount/);
 assert.match(page,/organization_id',org/);
 assert.match(page,/CampaignHistoryTable/);
 assert.match(ui,/Search campaign history/);
 assert.match(ui,/Filter campaign status/);
 assert.match(ui,/View details/);
 assert.match(ui,/Not necessarily delivered to inboxes/);
});
test('Delivery detail distinguishes provider acceptance from actual delivery',()=>{
 const page=read('app/dashboard/communications/history/page.tsx');
 const labels=read('lib/direct/delivery-view.ts');
 assert.match(page,/totals.delivered/);
 assert.match(page,/totals.accepted/);
 assert.match(page,/Accepted means the email provider received the request/);
 assert.match(page,/deliverySummaryText\(totals\)/);
 assert.match(page,/DirectRecipientOutcomes/);
 assert.match(labels,/accepted:'Accepted by provider'/);
 assert.match(labels,/completed:'Processed'/);
});
test('Staff-only sender test remains behind original permissions, verified sender and recipient lock',()=>{
 const page=read('app/dashboard/communications/page.tsx');
 const action=read('app/dashboard/senders/actions.ts');
 assert.doesNotMatch(page,/Staff-only test email/);
 assert.match(action,/senderAccess\(org\)/);
 assert.match(action,/to:user.email/);
 assert.match(action,/email_test_reserve/);
 assert.match(action,/verified/);
 assert.doesNotMatch(read('components/direct-delivery-history.tsx'),/adapter.sendTest|sendDirectBatch/);
});
test('Individual outcomes support filtering without exposing customer addresses',()=>{
 const ui=read('components/direct-recipient-outcomes.tsx');
 assert.match(ui,/Filter delivery outcomes/);
 assert.match(ui,/recipientStatusLabel\(r.status\)/);
 assert.match(ui,/Refresh the page/);
 assert.doesNotMatch(ui,/r.email|r.phone|r.account_number/);
});
