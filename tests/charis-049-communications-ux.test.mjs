import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=p=>readFileSync(new URL('../'+p, import.meta.url),'utf8');
test('communications default to direct send; old editor is not the primary message creation path',()=>{
 const home=file('app/dashboard/communications/page.tsx');
 const legacy=file('app/dashboard/campaigns/page.tsx');
 assert.match(home,/New message/);
 assert.match(legacy,/redirect\('\/dashboard\/communications\/new'\)/);
 assert.match(legacy,/Previous campaign workflow/);
});
test('legacy Resend reporting distinguishes broadcast acceptance from old queue counters',()=>{
 const delivery=file('app/dashboard/delivery/page.tsx');
 const report=file('app/dashboard/reports/page.tsx');
 assert.match(delivery,/Submitted to Resend/);
 assert.match(delivery,/!resendByRun.has\(r.id\)&&r.providerCounts/);
 assert.match(report,/Legacy queue counters are excluded/);
 assert.match(report,/This is not proof of delivery/);
});
test('history permissions are delegated, audited, and destructive deletion is limited to unsent messages',()=>{
 const sql=file('supabase/migrations/049_charis_communications_history_permissions.sql');
 for(const term of ['charis_direct_can_manage_history','charis_direct_history_access_save','charis_direct_history_manage','pending_approval','direct.message_','archived_at'])assert.ok(sql.includes(term),term);
 assert.match(sql,/status<>'pending'/);
 assert.match(sql,/INSERT INTO public.audit_logs/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public.charis_direct_history_manage/);
 assert.ok(!sql.includes('DROP TABLE'));
});
test('staff editor is concise, and recorded email status does not claim inbox delivery',()=>{
 const composer=file('components/direct-compose.tsx');const history=file('app/dashboard/communications/history/page.tsx');
 assert.match(composer,/name="title" value=\{subject.slice\(0,120\)\}/);
 assert.match(composer,/:'Send now'/);
 assert.match(history,/not the same as delivered/);
});
