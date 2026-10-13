import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
test('login routes active sessions directly to dashboard without client refresh race',()=>{
 assert.match(read('app/login/page.tsx'),/currentVerifiedUser/);
 assert.match(read('app/login/page.tsx'),/redirect\('\/dashboard'\)/);
 assert.match(read('components/auth-form.tsx'),/window\.location\.replace\('\/dashboard'\)/);
 assert.doesNotMatch(read('components/auth-form.tsx'),/router\.refresh/);
});
test('public pages no longer require an extra middleware getUser network request',()=>{
 const middleware=read('middleware.ts');
 assert.match(middleware,/if\(!protectedPage\)return response;/);
 assert.match(middleware,/client\.auth\.getUser\(\)/);
 assert.match(middleware,/NextResponse\.redirect\(new URL\('\/login'/);
});
test('dashboard loads a single authorised summary and brand URLs are cached',()=>{
 const dash=read('app/dashboard/page.tsx');
 assert.match(dash,/db\.rpc\('charis_dashboard_overview'/);
 assert.doesNotMatch(dash,/db\.from\('campaign_drafts'\)/);
 assert.match(read('lib/charis-brand-assets.ts'),/unstable_cache/);
 assert.match(read('app/dashboard/branding/media-actions.ts'),/revalidateTag\('charis-brand-assets'\)/);
});
test('Campaign Lead is assignable and is independently authorised for edit approve and dispatch',()=>{
 const sql=read('supabase/migrations/019_charis_dashboard_and_campaign_lead.sql');
 for(const x of ['can_edit_campaigns','can_approve_campaigns','can_dispatch_campaigns','team_invite_prepare','team_member_save','charis_campaign_test_reserve','campaign_lead'])assert.ok(sql.includes(x),x);
 assert.match(read('components/management-forms.tsx'),/Campaign lead/);
 assert.match(read('app/dashboard/team/actions.ts'),/campaign_lead/);
 assert.match(read('app/dashboard/approvals/page.tsx'),/c\.edited_by!==user\.id&&c\.submitted_by!==user\.id/);
 assert.match(read('supabase/migrations/008_campaign_workflows.sql'),/A different authorized person must review this campaign/);
});
test('Dashboard RPC does not return contact addresses or mutate customer records',()=>{
 const sql=read('supabase/migrations/019_charis_dashboard_and_campaign_lead.sql');
 const section=sql.split('CREATE OR REPLACE FUNCTION public.charis_dashboard_overview')[1].split('REVOKE ALL ON FUNCTION public.charis_dashboard_overview')[0];
 assert.match(section,/auth\.uid\(\) IS NULL/);
 assert.match(section,/organization_members/);
 assert.doesNotMatch(section,/\b(?:INSERT|UPDATE|DELETE)\s+/i);
 assert.doesNotMatch(section,/\b(?:email|phone)\b/i);
});
