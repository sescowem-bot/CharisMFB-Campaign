-- CHARIS RELEASE 036 — READ ONLY DATABASE PREREQUISITES
-- Does not apply migrations, create users, alter permissions or send messages.
-- PRESENT does not prove correct RBAC behaviour; run per-role staging tests separately.
WITH checkpoints AS (
 SELECT * FROM (VALUES
 ('032 credit reminder items',to_regclass('public.charis_credit_reminder_items') IS NOT NULL),
 ('032 held delivery items',to_regclass('public.charis_credit_delivery_holds') IS NOT NULL),
 ('033 follow-up tasks',to_regclass('public.charis_credit_followups') IS NOT NULL),
 ('033 staff notification inbox',to_regclass('public.charis_staff_notifications') IS NOT NULL),
 ('034 operational insights procedure',to_regprocedure('public.charis_operational_insights(uuid,timestamp with time zone,timestamp with time zone)') IS NOT NULL),
 ('034 view permission',(SELECT count(*)=1 FROM public.charis_permission_catalog WHERE permission_key='operations.view')),
 ('credit follow-up RLS',(SELECT coalesce(bool_and(relrowsecurity),false) FROM pg_class WHERE oid IN (to_regclass('public.charis_credit_followups'),to_regclass('public.charis_staff_notifications')) AND oid IS NOT NULL HAVING count(*)=2)),
 ('credit reminder items unique index',to_regclass('public.charis_credit_reminder_items_org_id_uidx_032') IS NOT NULL),
 ('active single-bank organisation',(SELECT count(*)=1 FROM public.organizations WHERE slug='charis-mfb' AND status='active'))
 ) x(checkpoint,present)
)
SELECT checkpoint,CASE WHEN present THEN 'PRESENT' ELSE 'MISSING / REVIEW' END AS status FROM checkpoints ORDER BY checkpoint;
