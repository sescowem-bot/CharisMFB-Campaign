-- CHARIS: READ-ONLY presentation readiness check.
-- IMPORTANT: Run ONLY in the verified Charis production Supabase project.
-- Do not run against Business Platform or another unrelated project.
-- No writes, deletes, role changes or schema mutations.
-- Presence of a table/function is not proof of full migration success.
SELECT 'Contacts' AS capability,
 to_regclass('public.contacts') IS NOT NULL AS detected
UNION ALL SELECT 'Loan portfolio',to_regclass('public.charis_loans') IS NOT NULL
UNION ALL SELECT 'Repayment reminder batches',to_regclass('public.charis_credit_reminder_batches') IS NOT NULL
UNION ALL SELECT 'Campaign messages',to_regclass('public.charis_direct_messages') IS NOT NULL
UNION ALL SELECT 'Campaign delivery events (060)',to_regclass('public.charis_direct_delivery_events_060') IS NOT NULL
UNION ALL SELECT 'Provider selection field (075)',EXISTS(
 SELECT 1 FROM information_schema.columns
 WHERE table_schema='public' AND table_name='charis_direct_messages'
 AND column_name='preferred_provider'
)
UNION ALL SELECT 'Zoho correspondence audit (077)',to_regclass('public.charis_zoho_manual_letters') IS NOT NULL
UNION ALL SELECT 'ZeptoMail transactional audit (079)',to_regclass('public.charis_zeptomail_notices') IS NOT NULL
UNION ALL SELECT 'Operational insights RPC',EXISTS(
 SELECT 1 FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='charis_operational_insights'
)
ORDER BY capability;
