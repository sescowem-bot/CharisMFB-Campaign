import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const src=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
test('preferences page requires bank-authorised staff access',()=>{
 const content=src('app/dashboard/preferences/page.tsx');
 assert.match(content,/contactsAccess\(org\)/);
 assert.match(content,/if\(!user\)redirect\('\/login'\)/);
 assert.match(content,/if\(!authorized\)redirect\('\/dashboard'\)/);
});
test('unsubscribe is distinguished from refusal, unknown consent and delivery blocks',()=>{
 const content=src('app/dashboard/preferences/page.tsx');
 for(const value of ['Unsubscribed from promotions','Declined promotions','Permission not confirmed','Agreed to promotions','Email delivery blocked']) assert.ok(content.includes(value),value);
 assert.match(content,/\.eq\('reason','unsubscribe'\)/);
 assert.match(content,/\['bounce','complaint','blocked'\]/);
});
test('unsubscribe remains purpose-specific, not account closure',()=>{
 const content=src('app/unsubscribe/page.tsx');
 assert.match(content,/does not close your Charis account/);
 assert.match(content,/Stop promotional emails/);
});
test('preferences are visible in staff navigation and customer management',()=>{
 assert.match(src('components/charis-navigation.tsx'),/Communication preferences/);
 assert.match(src('app/dashboard/contacts/page.tsx'),/Unsubscribed & preferences/);
});
test('no service notice sending channel introduced, and unsubscribe policy preserved',()=>{
 const content=src('MD/SECURITY_AND_COMMUNICATION_PREFERENCES.md');
 assert.match(content,/DOES NOT implement live account-notice/);
 assert.match(src('supabase/migrations/009_delivery_engine.sql'),/consent_status='granted'/);
});
