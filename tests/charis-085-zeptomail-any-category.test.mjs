import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('All message categories can use Zoho only for individual transactional events',()=>{
 const ui=read('components/direct-compose.tsx');
 const action=read('app/dashboard/communications/actions.ts');
 const worker=read('lib/direct/dispatch.ts');
 const sql=read('supabase/migrations/083_charis_zeptomail_category_policy.sql');
 assert.match(ui,/const zeptoEligible=channel==='email'&&audience==='selected'/);
 assert.match(ui,/I confirm each selected customer has a genuine bank event or request/);
 assert.doesNotMatch(action,/parsed.purpose!=='account_update'/);
 assert.match(action,/zepto_transactional_acknowledged/);
 assert.match(worker,/zepto_transactional_acknowledged/);
 assert.match(sql,/purpose IN \('account_update','service_notice','general_notice'\)/);
 assert.match(sql,/p_purpose NOT IN \('account_update','service_notice','general_notice'\)/);
 assert.match(sql,/SET preferred_provider='zeptomail',zepto_event_reference=trim\(p_reference\),zepto_transactional_acknowledged=true/);
 assert.match(sql,/NOT BETWEEN 1 AND 500/);
});
