-- CHARIS 035 release review. READ-ONLY. Does not execute or reapply migrations.
-- Inspect outcomes before assuming 032/033/034 are present. Does not certify RLS correctness.
SELECT checkpoint, CASE WHEN present THEN 'PRESENT' ELSE 'MISSING - REVIEW MIGRATION STATUS' END AS status
FROM (
 VALUES
 ('032 reminder items table', to_regclass('public.charis_credit_reminder_items') IS NOT NULL),
 ('032 reminder holds table', to_regclass('public.charis_credit_delivery_holds') IS NOT NULL),
 ('033 follow-ups table', to_regclass('public.charis_credit_followups') IS NOT NULL),
 ('033 staff notifications table', to_regclass('public.charis_staff_notifications') IS NOT NULL),
 ('034 insights function', to_regprocedure('public.charis_operational_insights(uuid,timestamp with time zone,timestamp with time zone)') IS NOT NULL),
 ('034 operations permission', EXISTS (SELECT 1 FROM public.charis_permission_catalog WHERE permission_key='operations.view'))
) AS checks(checkpoint,present)
ORDER BY checkpoint;
