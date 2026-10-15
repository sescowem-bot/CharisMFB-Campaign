import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const migration=read('supabase/migrations/030_charis_branch_read_guards.sql');
const branchPage=read('app/dashboard/branches/page.tsx');
const branchForms=read('components/charis-branch-forms.tsx');
const dashboard=read('app/dashboard/page.tsx');

test('030 reinforces branch-sensitive direct table SELECT policies',()=>{
 const tables=['contacts','contact_lists','contact_list_members','contact_segments','contact_import_batches','campaign_drafts','campaign_revisions','campaign_runs','charis_sms_campaigns','charis_sms_tests','email_test_attempts','email_suppressions'];
 for(const table of tables){
  const re=new RegExp(`ON public\\.${table}\\s+AS RESTRICTIVE FOR SELECT TO authenticated`);
  assert.match(migration,re,`Missing AND-style read guard for ${table}`);
 }
 assert.match(migration,/public\.charis_can_view_customer\(organization_id,id\)/);
});

test('branch restricted staff do not retain global admin permissions',()=>{
 for(const key of ['staff.manage','access.manage','departments.manage','branches.manage','providers.manage','settings.manage','campaigns.send','audit.view']){
  assert.ok(migration.includes(`'${key}'`),`Missing access gate for ${key}`);
 }
 assert.match(migration,/AND NOT public\.charis_is_bankwide\(p_org\)/);
});

test('security definer reporting endpoints check assigned permissions',()=>{
 for(const key of ['campaign_audience_count','campaign_analytics','delivery_summary','charis_delivery_provider_summary','charis_dashboard_overview']){
  assert.ok(migration.includes(`FUNCTION public.${key}(`),`Missing guarded ${key}`);
 }
 assert.match(migration,/v_campaigns:=public\.charis_has_permission\(p_org,'campaigns\.view'\)/);
 assert.match(migration,/public\.charis_can_view_customer\(p_org,c\.id\)/);
});

test('branch archive respects staff and customer assignments',()=>{
 assert.match(migration,/Remove staff assignments before archiving this branch/);
 assert.match(migration,/Reassign customers before archiving this branch/);
});

test('branch operations support customer search and explicit selection',()=>{
 assert.match(branchPage,/customerQuery\.or\(/);
 assert.match(branchPage,/customerSearch/);
 assert.match(branchForms,/Select a customer/);
 assert.match(branchForms,/Select a branch/);
 assert.match(branchForms,/onChange=\{e=>\{setSelectedStaff/);
});

test('home dashboard shortcuts are permission-aware',()=>{
 assert.match(dashboard,/canReadCustomers/);
 assert.match(dashboard,/canCreate&&/);
 assert.match(dashboard,/canApprove&&/);
 assert.match(dashboard,/\.filter\(item=>item\.show\)/);
});
