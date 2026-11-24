import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const wizard=read('components/contact-import-wizard.tsx');
const route=read('app/api/contacts/import/route.ts');
const action=read('app/dashboard/contacts/actions.ts');
const form=read('components/contact-forms.tsx');
const migration=read('supabase/migrations/044_charis_flexible_contact_import_and_consent.sql');

test('staff consent confirmation requires only a record type and confirmation checkbox',()=>{
 assert.match(wizard,/consentSource/);
 assert.match(wizard,/consentConfirmed/);
 assert.match(wizard,/staff-confirmed-import:/);
 assert.doesNotMatch(wizard,/consentReference|consentDate|consentProduct/);
 assert.match(form,/name="consent_source"/);
 assert.match(form,/name="consent_confirmed"/);
 assert.match(action,/Staff confirmed existing permission via/);
});

test('spreadsheet import supports up to 56 optional customer attributes end to end',()=>{
 assert.match(wizard,/MAX_EXTRA=56/);
 assert.match(route,/Object\.keys\(value\)\.length<=56/);
 assert.match(form,/slice\(0,56\)/);
 assert.match(form,/details\.length>=56/);
 assert.match(action,/entries\.length>56/);
 assert.match(migration,/v_count>56/);
 assert.match(migration,/jsonb_object_keys\(v_attributes\)\)>56/);
 assert.match(migration,/length\(v_attributes::text\)>16000/);
});

test('large-column imports use smaller request batches and keep sensitive fields filtered',()=>{
 assert.match(wizard,/selectedExtras\.length>20\?4:selectedExtras\.length\?25:100/);
 assert.match(route,/password\|passcode\|pin\|otp\|bvn\|nin/);
});
