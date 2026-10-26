import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
test('optional email budget read cannot suppress routing controls',()=>{
 const s=read('app/admin/providers/page.tsx');
 assert.match(s,/settings\.error\|\|senders\.error\|\|domains\.error/);
 assert.doesNotMatch(s,/if\(monthly\.error\)return/);
 assert.match(s,/monthly\.error\?/);
 assert.match(s,/ProviderRouteForm/);
});
test('production error boundary displays safe digest and return navigation',()=>{
 const s=read('app/error.tsx');
 assert.match(s,/error\.digest/);
 assert.match(s,/href="\/dashboard"/);
 assert.doesNotMatch(s,/error\.message/);
});
test('one complete read-only SQL diagnostic with no loose CASE',()=>{
 const s=read('supabase/verification/046_routing_readonly.sql');
 const code=s.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n').trim();
 assert.match(code,/^SELECT\s/i);
 assert.equal((code.match(/;/g)||[]).length,1);
 assert.doesNotMatch(code,/\bUPDATE\s+public\.|\bDELETE\s+FROM\s+public\.|\bINSERT\s+INTO\s+public\./i);
 assert.match(code,/budget_admin_policy_exists/);
});
