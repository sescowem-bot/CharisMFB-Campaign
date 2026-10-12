import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
test('Charis sender is configured through admin input, not a Vercel email variable',()=>{
 const action=read('app/dashboard/senders/charis-actions.ts');
 const form=read('components/charis-resend-form.tsx');
 const page=read('app/dashboard/senders/page.tsx');
 const server=read('lib/email/server.ts');
 for(const source of [action,page,server]){
  assert.doesNotMatch(source,/CHARIS_FROM_EMAIL|CHARIS_REPLY_TO/);
 }
 assert.match(action,/form\.get\('from_name'\)/);
 assert.match(action,/form\.get\('from_local'\)/);
 assert.match(action,/form\.get\('from_domain'\)/);
 assert.match(action,/form\.get\('reply_to'\)/);
 assert.match(action,/senderAccess\(org\)/);
 assert.match(action,/listVerifiedResendDomains\(\)/);
 assert.match(action,/providerAdapter\('resend',apiKey\)\.check\(domain,match\.providerId\)/);
 assert.match(form,/Save sender settings/);
});
test('the Resend domain discovery is server only and filters for verification + sending capability',()=>{
 const helper=read('lib/email/charis-resend.ts');
 assert.match(helper,/import 'server-only'/);
 assert.match(helper,/RESEND_API_KEY/);
 assert.match(helper,/row\.status!=='verified'/);
 assert.match(helper,/row\.capabilities\?\.sending!=='enabled'/);
 assert.match(helper,/api\.resend\.com\/domains/);
});
