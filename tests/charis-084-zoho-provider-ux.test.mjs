import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
test('Zoho option remains visible and explains when it cannot yet be chosen',()=>{
 const c=read('components/direct-compose.tsx');
 assert.match(c,/<option value="zeptomail" disabled=\{!zeptoEligible\|\|!zeptoReady\}/);
 assert.match(c,/Zoho ZeptoMail · Setup pending/);
 assert.match(c,/Select customer account notice/);
 assert.match(c,/Change message type to Customer account notice/);
 assert.match(c,/setPurpose\('account_update'\)/);
 assert.match(c,/setConfirmed\(false\)/);
});
test('Mail Agent provider page separates SMTP availability from notification campaign activation',()=>{
 const page=read('app/admin/providers/page.tsx');
 assert.match(page,/zeptoNotificationBatchReady\(\)/);
 assert.match(page,/Connection testing can work even while this is off/);
});
test('Invalid personalization explains the offending customer detail without allowing arbitrary fields',()=>{
 const s=read('lib/direct/campaign-design.ts');
 assert.match(s,/allowedCustomerToken\(token\)/);
 assert.match(s,/customer field \{\{/);
 assert.match(s,/Go back to Write message and use Insert customer details/);
 assert.match(s,/incomplete brackets/);
});
