import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const migration=read('supabase/migrations/045_charis_safe_contact_deletion_and_bulk_actions.sql');
const actions=read('app/dashboard/contacts/actions.ts');
const table=read('components/customer-table.tsx');
const row=read('components/contact-row-actions.tsx');
const importRoute=read('app/api/contacts/import/route.ts');
const contactsPage=read('app/dashboard/contacts/page.tsx');

test('safe bulk deletion handles each customer independently',()=>{
 assert.match(migration,/charis_bulk_contacts_safe/);
 assert.match(migration,/EXCEPTION WHEN OTHERS/);
 assert.match(migration,/v_succeeded/);
 assert.match(migration,/v_failed/);
 assert.match(migration,/charis_contact_delete/);
 assert.match(migration,/charis_contact_archive/);
 assert.match(migration,/GRANT EXECUTE/);
});

test('bulk action uses the safe RPC and returns staff-friendly summaries',()=>{
 assert.match(actions,/charis_bulk_contacts_safe/);
 assert.doesNotMatch(actions,/charis_bulk_contacts',/);
 assert.match(actions,/could not be processed/);
 assert.match(table,/setSelected\(\[\]\)/);
});

test('contact actions do not expose database or migration errors',()=>{
 assert.doesNotMatch(actions,/Apply Charis SQL migration/);
 assert.doesNotMatch(actions,/error\.message\}/);
 assert.match(actions,/We could not complete that action/);
 assert.match(row,/Please wait/);
 assert.match(importRoute,/We could not import this group of customers/);
 assert.doesNotMatch(importRoute,/error\.message/);
 assert.match(contactsPage,/We could not load the customer list/);
});
