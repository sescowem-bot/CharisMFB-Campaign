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
 const prefs=action.indexOf('directEmailReadiness(org)');
 assert.ok(auth>0 && prefs>auth);
});
test('server-only sender readiness checks provider, sender, domain and enabled status',()=>{
 const helper=readFileSync(new URL('../lib/direct/readiness.ts',import.meta.url),'utf8');
 assert.match(action,/import \{directEmailReadiness,directWorkerIsHealthy\}/);
 assert.match(helper,/emailServiceDb\(\)/);
 for(const table of ['charis_direct_provider_prefs','email_provider_settings','sender_identities','sending_domains'])
  assert.ok(helper.includes(table),table);
 assert.doesNotMatch(action,/await db.from\('charis_direct_provider_prefs'\)/);
});
test('missing schema and unusable senders fail closed before reserving a campaign',()=>{
 assert.match(action,/readiness.reason==='schema_missing'/);
 assert.match(action,/No verified service email sender is ready/);
 const preflight=action.indexOf('directEmailReadiness(org)');
 const create=action.indexOf("db.rpc('charis_direct_create_v2'");
 assert.ok(preflight>0&&create>preflight);
});
