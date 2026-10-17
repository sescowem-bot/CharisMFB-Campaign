-- Release 057 read-only Supabase readiness check. No schema/data changes.
-- Do not execute send/claim functions for this check.
SELECT 'Direct campaigns table' AS feature, to_regclass('public.charis_direct_messages') IS NOT NULL AS installed
UNION ALL SELECT 'Recipient outcomes',to_regclass('public.charis_direct_recipients') IS NOT NULL
UNION ALL SELECT 'Optional email preferences',to_regclass('public.charis_optional_email_optouts') IS NOT NULL
UNION ALL SELECT 'Credit auto rules',to_regclass('public.charis_credit_auto_rules_056') IS NOT NULL
UNION ALL SELECT 'Credit due suggestions',to_regclass('public.charis_credit_auto_candidates_056') IS NOT NULL;
SELECT 'Create campaign v2' AS feature,
       to_regprocedure('public.charis_direct_create_v2(uuid,uuid,text,text,text,text,text,text,text,uuid[],uuid,jsonb,timestamp with time zone)') IS NOT NULL AS installed
UNION ALL SELECT 'Scheduled campaign cancellation',
       to_regprocedure('public.charis_direct_cancel_scheduled(uuid,uuid)') IS NOT NULL
UNION ALL SELECT 'Loan due scan',
       to_regprocedure('public.charis_credit_auto_generate_056(uuid)') IS NOT NULL
UNION ALL SELECT 'Direct recipient claim',
       to_regprocedure('public.charis_direct_claim(uuid,uuid)') IS NOT NULL;
-- Optional: run the existing previous-release verification SQL after checking all tables exist.
