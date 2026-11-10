import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [button,actions,page]=await Promise.all([
 readFile(new URL('../app/admin/zoho-contacts/sync-button.tsx',import.meta.url),'utf8'),
 readFile(new URL('../app/admin/zoho-contacts/actions.ts',import.meta.url),'utf8'),
 readFile(new URL('../app/admin/zoho-contacts/page.tsx',import.meta.url),'utf8')
]);

test('Zoho sync button exposes pending and result states',()=>{
 assert.match(button,/useActionState/);
 assert.match(button,/Synchronising Zoho contacts/);
 assert.match(button,/state\.message/);
 assert.match(button,/role=\{state\.success\?'status':'alert'\}/);
});

test('Zoho server action returns the real sync result to the form',()=>{
 assert.match(actions,/return await syncZohoContacts\(\)/);
 assert.match(actions,/Promise<ZohoSyncActionState>/);
 assert.match(page,/<ZohoSyncButton \/>/);
});
