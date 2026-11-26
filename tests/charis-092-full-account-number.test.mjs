import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const actions=read('app/dashboard/contacts/actions.ts');
const form=read('components/contact-forms.tsx');
const migration=read('supabase/migrations/092_charis_full_account_number_campaign_personalization.sql');

test('contact saving no longer rejects full account numbers',()=>{
 assert.doesNotMatch(actions,/last four digits for account references/);
 assert.match(form,/full account number for approved customer communications/);
});

test('database migration removes the legacy four-digit-only rule without rewriting existing records',()=>{
 assert.match(migration,/charis_save_contact_with_details/);
 assert.match(migration,/Could not safely remove the legacy account-number restriction/);
 assert.match(migration,/Existing stored values are not reconstructed or changed/);
});
