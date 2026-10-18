import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const action=readFileSync(new URL('../app/dashboard/communications/actions.ts',import.meta.url),'utf8');
const rls=readFileSync(new URL('../supabase/migrations/047_charis_simple_communications.sql',import.meta.url),'utf8');
test('provider preferences are admin-only under SQL 047 RLS',()=>{
 assert.match(rls,/CREATE POLICY charis_direct_prefs_read[\s\S]*?USING\(public\.charis_direct_is_admin\(organization_id\)\)/);
});
test('user sending permission is checked before server-only provider lookup',()=>{
 const auth=action.indexOf("db.rpc('charis_direct_can_send'");
 const prefs=action.indexOf(".from('charis_direct_provider_prefs')");
 assert.ok(auth>0 && prefs>auth);
});
test('server-side read bypasses false empty staff RLS response',()=>{
 assert.match(action,/import \{emailServiceDb\} from '@\/lib\/email\/server'/);
 assert.match(action,/await emailServiceDb\(\)[\s\S]*?\.from\('charis_direct_provider_prefs'\)/);
 assert.doesNotMatch(action,/await db\.from\('charis_direct_provider_prefs'\)/);
});
test('missing provider and lookup failure are differentiated',()=>{
 assert.match(action,/Email sending configuration could not be checked/);
 assert.match(action,/No service email sender is enabled/);
});
