-- Read-only verification for Charis Batch 6 (034).
-- Run after Migration 034 in the EXISTING Charis Supabase project.
-- Confirm the permission and function are installed; role/branch checks must still be
-- exercised with real RLS-restricted staff sessions in a staging database.
SELECT 'operations.view permission' AS check_name,
 EXISTS(SELECT 1 FROM public.charis_permission_catalog WHERE permission_key='operations.view') AS installed;
SELECT 'Operational insights function' AS check_name,
 to_regprocedure('public.charis_operational_insights(uuid,timestamp with time zone,timestamp with time zone)') IS NOT NULL AS installed;
SELECT 'Function executable by authenticated' AS check_name,
 has_function_privilege('authenticated','public.charis_operational_insights(uuid,timestamptz,timestamptz)','EXECUTE') AS granted;
SELECT 'Function not executable by anon' AS check_name,
 NOT has_function_privilege('anon','public.charis_operational_insights(uuid,timestamptz,timestamptz)','EXECUTE') AS enforced;
