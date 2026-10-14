import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const sql=read('supabase/migrations/022_charis_import_exception_review.sql');
const wizard=read('components/contact-import-wizard.tsx');
const review=read('components/import-issue-review.tsx');
const api=read('app/api/contacts/import/issues/route.ts');
const importApi=read('app/api/contacts/import/route.ts');
const contacts=read('app/dashboard/contacts/page.tsx');
test('preserves existing RPC signatures and import idempotency',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public.import_contact_batch\(p_org uuid,p_batch_key uuid,p_rows jsonb\)/i);
 assert.match(sql,/ON CONFLICT\(organization_id,batch_key\) DO NOTHING/i);
 assert.match(sql,/v_skipped:=v_skipped\+1/);
 assert.match(sql,/v_rejected:=v_rejected\+1/);
 assert.match(sql,/consent_status,attributes,created_by/);
 assert.match(sql,/'import','unknown'/);
});
test('issue table is protected by RLS and only creates review entries for exceptions',()=>{
 assert.match(sql,/ALTER TABLE public.contact_import_issues ENABLE ROW LEVEL SECURITY/i);
 assert.match(sql,/TO authenticated USING\(public.can_manage_contacts\(organization_id\)\)/i);
 assert.match(sql,/REVOKE ALL ON public.contact_import_issues FROM PUBLIC,anon/i);
 assert.match(sql,/GRANT SELECT ON public.contact_import_issues TO authenticated/i);
 assert.match(sql,/issue_type,reason_code,first_name,last_name,email,phone/);
 assert.doesNotMatch(sql,/contact_import_issues\(.*attributes/);
});
test('row source references remain linked from browser to database',()=>{
 assert.match(wizard,/source_row:i\*batchSize\+j\+2/);
 assert.match(importApi,/source_row:z\.number\(\)\.int\(\)/);
 assert.match(sql,/v_row->>'source_row'/);
 assert.match(review,/Excel row \{item.source_row\}/);
});
test('review does not bypass marketing consent or overwrite duplicates',()=>{
 assert.match(wizard,/marketing emails|marketing campaigns|communication permission/);
 assert.match(review,/will not overwrite existing customers|does not overwrite existing customers|will not overwrite existing customers, change consent/);
 assert.match(sql,/EXISTS\(SELECT 1 FROM public.contacts c WHERE c.organization_id=p_org/);
 assert.match(api,/contactsAccess\(body.data.org\)/);
 assert.match(api,/sameOrigin\(request\)/);
 assert.match(api,/Cache-Control/);
});
test('customer consent filter is available',()=>{
 assert.match(contacts,/consent-filter/);
 assert.match(contacts,/request=request.eq\('consent_status',consent\)/);
});
