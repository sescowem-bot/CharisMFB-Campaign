-- Run using Supabase SQL Editor after executing Migration 056.
SELECT to_regclass('public.charis_credit_auto_rules_056') AS rules_table,
       to_regclass('public.charis_credit_auto_candidates_056') AS suggestions_table;
SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
 ('charis_credit_auto_rules_save_056','charis_credit_auto_generate_056','charis_credit_auto_resolve_056')
ORDER BY p.proname;
SELECT organization_id,enabled,offsets,channel,max_daily,updated_at
FROM public.charis_credit_auto_rules_056 LIMIT 10;
SELECT status,count(*) FROM public.charis_credit_auto_candidates_056 GROUP BY status ORDER BY status;
