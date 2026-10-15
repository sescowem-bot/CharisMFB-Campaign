import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Legacy sender mutations are denied; only a verified Charis staff test is allowed',()=>{
 const s=read('app/dashboard/senders/actions.ts');
 assert.match(s,/org!==charisOrgId\(\)/);
 assert.match(s,/form.get\('action'\)!=='test'/);
 assert.match(s,/senderAccess\(org\)/);
 assert.match(s,/row.charis_connected!==true/);
 assert.match(s,/refreshDomain\(org,sender.domain_id\)/);
 assert.match(s,/email_test_reserve/);
 assert.doesNotMatch(s,/email_domain_reserve|email_domain_revoke|email_sender_save|\.create\(/);
 assert.match(s,/status:'unknown'/);
});

test('Provider settings permit only bank-authorised admins and scoped RPC',()=>{
 const a=read('app/admin/providers/actions.ts');
 const page=read('app/admin/providers/page.tsx');
 assert.match(a,/const org=charisOrgId\(\)/);
 assert.match(a,/charisAdmin!==true/);
 assert.match(a,/charis_provider_configure/);
 assert.doesNotMatch(a,/admin_email_provider_save|admin_provider_limits/);
 assert.match(page,/const org=charisOrgId\(\)/);
 assert.match(page,/charisAdmin!==true/);
});

test('Domain verification update is limited to the active Charis organisation',()=>{
 const s=read('lib/email/server.ts');
 assert.match(s,/update\(\{verification_status:'pending'\}\)\.eq\('id',id\)\.eq\('organization_id',org\)/);
 assert.match(s,/row.charis_connected===true/);
});

test('Release gate requires Charis UUID and refuses premature delivery',()=>{
 const script=read('scripts/check-release.mjs');
 assert.match(script,/Charis organisation UUID configured/);
 assert.match(script,/env.CHARIS_MULTI_PROVIDER_ENABLED!=='true'/);
 assert.match(script,/env.EMAIL_DELIVERY_ENABLED==='false'/);
 assert.doesNotMatch(script,/Legacy billing key configured/);
});

test('Delivery indicator does not certify acceptance from a Vercel flag',()=>{
 const shell=read('components/workspace-shell.tsx');
 assert.match(shell,/Delivery gate enabled/);
 assert.match(shell,/worker status must still be verified/);
 assert.match(shell,/Customer sending off/);
});
