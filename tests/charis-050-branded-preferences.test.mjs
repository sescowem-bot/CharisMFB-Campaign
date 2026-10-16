import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('public unsubscribe uses POST confirmation and never mutates on GET',()=>{
 const page=read('app/unsubscribe/page.tsx');
 const route=read('app/api/preferences/unsubscribe/route.ts');
 assert.match(page,/method="post"/);assert.match(route,/export async function POST/);
 assert.doesNotMatch(route,/export async function GET/);
 assert.match(page,/Return to Charis website/);
});
test('direct mail supplies own destination, opt-out checks and List-Unsubscribe headers',()=>{
 const s=read('lib/direct/dispatch.ts');const transport=read('lib/delivery/transport.ts');
 assert.match(s,/reservePreferenceLink/);assert.match(s,/charis_optional_email_optouts/);
 assert.match(s,/\/api\/preferences\/unsubscribe/);
 assert.match(transport,/List-Unsubscribe-Post/);
});
test('service-only SQL opt-outs are idempotent and revoke marketing consent',()=>{
 const s=read('supabase/migrations/050_charis_branded_email_preferences.sql');
 assert.match(s,/auth\.role\(\) <> 'service_role'/);
 assert.match(s,/IF v_link\.used_at IS NOT NULL THEN RETURN 'done'/);
 assert.match(s,/consent_status='denied'/);
 assert.match(s,/email_suppressions/);
 assert.match(s,/REVOKE ALL ON public\.charis_email_preference_tokens/);
});
test('Broadcast provider-managed unsubscribe remains untouched',()=>{
 const s=read('app/dashboard/campaigns/resend-action.ts');
 assert.match(s,/RESEND_UNSUBSCRIBE_URL/);
});
