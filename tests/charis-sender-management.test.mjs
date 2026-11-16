import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Zoho Campaigns is removed from the administration UI',()=>{
 const page=read('app/admin/page.tsx');
 assert.doesNotMatch(page,/Zoho Campaigns|zoho-contacts/i);
});
test('sender management is provider-neutral and editable from the admin screen',()=>{
 const page=read('app/admin/providers/page.tsx');
 const component=read('components/sender-identity-manager.tsx');
 const actions=read('app/admin/providers/sender-actions.ts');
 assert.match(page,/SenderIdentityManager/);
 assert.match(component,/name="from_email"/);
 assert.match(component,/name="reply_to"/);
 assert.match(component,/name="provider"/);
 assert.match(component,/Save sender changes/);
 assert.match(component,/Delete sender/);
 assert.match(actions,/findVerifiedDomain\(domain\)/);
 assert.match(actions,/disableSenderIdentity/);
 assert.match(actions,/deleteSenderIdentity/);
 assert.doesNotMatch(actions,/sescoconcept|salemmedicals|charismfb\.com/i);
});
test('campaign copy recipients are stored in the atomic campaign RPC before dispatch',()=>{
 const action=read('app/dashboard/communications/actions.ts');
 const migration=read('supabase/migrations/089_charis_campaign_copy_recipients_and_zoho_retirement.sql');
 const dispatch=read('lib/direct/dispatch.ts');
 assert.match(action,/charis_direct_create_provider_089/);
 assert.match(migration,/ADD COLUMN IF NOT EXISTS cc_emails/);
 assert.match(migration,/ADD COLUMN IF NOT EXISTS bcc_emails/);
 assert.match(migration,/charis_direct_create_provider_089/);
 assert.match(dispatch,/cc:m\.cc_emails\|\|\[\]/);
 assert.match(dispatch,/bcc:m\.bcc_emails\|\|\[\]/);
});
