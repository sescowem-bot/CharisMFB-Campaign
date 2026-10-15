import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Vercel JSX error is escaped',()=>{const page=read('components/provider-route-form.tsx');assert.doesNotMatch(page,/bank's opted-in/);assert.match(page,/bank&amp;apos;|bank&apos;/);});
test('new uploads require evidence and do not infer opt-in',()=>{const route=read('app/api/contacts/import/route.ts'),sql=read('supabase/migrations/041_charis_documented_optin_imports.sql');assert.match(route,/confirmed:z.literal\(true\)/);assert.match(route,/charis_import_consented_batch/);assert.match(sql,/v_scope='all_marketing'/);assert.match(sql,/email_suppressions/);assert.match(sql,/contact_import_issues/);});
test('product-specific consent does not authorize general broadcast',()=>{const sql=read('supabase/migrations/041_charis_documented_optin_imports.sql');assert.match(sql,/v_email IS NOT NULL AND v_scope='all_marketing'/);assert.match(sql,/product_specific/);});
test('mailjet webhook is surfaced in admin, and real events retain auth',()=>{const ui=read('app/admin/providers/page.tsx'),webhook=read('app/api/email/webhooks/mailjet/route.ts');assert.match(ui,/MAILJET_WEBHOOK_SECRET/);assert.match(ui,/\/api\/email\/webhooks\/mailjet/);assert.match(webhook,/timingSafeEqual/);});
