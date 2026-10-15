import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const sql=read('supabase/migrations/034_charis_operational_insights.sql');
test('034 is additive, transaction-wrapped, and contains no sending mechanisms',()=>{
 assert.match(sql,/^-- CHARIS 034/);
 assert.match(sql,/\bBEGIN;[\s\S]*\bCOMMIT;\s*$/);
 assert.doesNotMatch(sql,/\b(DROP TABLE|TRUNCATE|DELETE FROM public\.|http_post|send_email|send_sms)\b/i);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.charis_operational_insights[\s\S]*FROM PUBLIC,anon/);
});
test('Operational summary requires permission and limits date window',()=>{
 assert.match(sql,/charis_has_permission\(p_org,'operations\.view'\)/);
 assert.match(sql,/charis_has_permission\(p_org,'reports\.view'\)/);
 assert.match(sql,/366 days/);
 assert.match(sql,/charis_permission_catalog/);
});
test('Every customer-related counter is customer-scoped',()=>{
 assert.match(sql,/charis_can_view_customer\(p_org,l\.contact_id\)/);
 assert.match(sql,/charis_can_view_customer\(p_org,f\.contact_id\)/);
 assert.match(sql,/charis_can_view_customer\(p_org,i\.contact_id\)/);
 assert.match(sql,/charis_can_view_customer\(p_org,s\.contact_id\)/);
 assert.match(sql,/f\.assigned_to=auth\.uid\(\)/);
});
test('Balances are aggregated over full repayment history, not paginated previews',()=>{
 assert.match(sql,/SELECT sum\(r\.amount\)/);
 assert.match(sql,/greatest\(l\.total_due/);
 assert.doesNotMatch(sql,/\bLIMIT\b/);
});
test('Server UI guards operational insights, report routing and audit access',()=>{
 const page=read('app/dashboard/insights/page.tsx');
 const campaign=read('app/dashboard/reports/page.tsx');
 const audit=read('app/admin/audit/page.tsx');
 assert.match(page,/operationalInsightsSchema\.safeParse\(data\)/);
 assert.match(page,/account\.permissions\.includes\('operations\.view'\)/);
 assert.match(campaign,/params\.set\('org',org\)/);
 assert.match(campaign,/reports\.view/);
 const exportRoute=read('app/api/reports/campaigns/route.ts');
 assert.match(exportRoute,/account\.permissions\.includes\('reports\.view'\)/);
 assert.match(exportRoute,/params\.set\('org',account\.workspace\.id\)/);
 assert.match(audit,/audit\.view/);
 assert.match(audit,/\.eq\('organization_id',org\)/);
 assert.match(audit,/\.range\(\(page-1\)\*50,page\*50\)/);
});
test('The operations overview explicitly disclaims live core ledger balances and held deliveries',()=>{
 const page=read('app/dashboard/insights/page.tsx');
 assert.match(page,/core banking reconciliation/);
 assert.match(page,/Held, not sent/);
 assert.match(read('components/workspace-shell.tsx'),/Operations insights/);
 assert.match(read('app/dashboard/help/page.tsx'),/Operational insights and audit/);
});
