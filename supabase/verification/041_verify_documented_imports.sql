-- READ ONLY: Check schema presence. These checks do not prove live consent data or sending eligibility.
SELECT to_regclass('public.charis_import_consent_records') AS consent_records_table,
 to_regclass('public.contact_import_issues') AS import_issue_table;
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS signature
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='charis_import_consented_batch';
SELECT count(*) AS general_optin_evidence_records FROM public.charis_import_consent_records WHERE permission_scope='all_marketing';
SELECT count(*) AS product_limited_records FROM public.charis_import_consent_records WHERE permission_scope='product_specific';
