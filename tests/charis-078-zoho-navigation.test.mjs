import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Administrators can find Zoho Mail and Test in Email settings before configuration',()=>{
 const s=read('components/workspace-shell.tsx');
 assert.doesNotMatch(s,/<NavLink href="\/dashboard\/zoho-smtp"/);
 assert.match(read('app/admin/providers/page.tsx'),/href="\/dashboard\/zoho-smtp"/);
 assert.doesNotMatch(s,/directAllowed&&process\.env\.ZOHO_SMTP_USER/);
});
test('The Zoho page is bank-scoped, shows missing setup and account mismatch without revealing credentials',()=>{
 const page=read('app/dashboard/zoho-smtp/page.tsx');
 assert.match(page,/account.workspace.id!==charisOrgId\(\)/);
 assert.match(page,/!account.providerAdmin&&\(!user.email_confirmed_at\|\|!ownsMailbox\)/);
 assert.match(page,/Connect your bank mailbox first/);
 assert.match(page,/Your Charis login does not match the Zoho mailbox/);
 assert.match(page,/ZOHO_SMTP_TEST_ENABLED/);
 assert.match(page,/ZOHO_SMTP_MANUAL_CLIENT_ENABLED/);
 assert.doesNotMatch(page,/<.*password.*value=\{process.env.ZOHO_SMTP_APP_PASSWORD\}/);
});
test('Visible navigation does not remove the staff-only SMTP verification gate',()=>{
 const a=read('app/dashboard/zoho-smtp/actions.ts');
 const b=read('app/dashboard/zoho-smtp/manual-actions.ts');
 assert.match(a,/mailbox\(user.email\)!==config.user/);
 assert.match(b,/config.user!==mailbox\(user.email\)/);
 assert.match(b,/ZOHO_SMTP_MANUAL_CLIENT_ENABLED/);
});
