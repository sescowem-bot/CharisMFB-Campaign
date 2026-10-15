-- Read-only verification; run AFTER migration 033 (no database writes).
SELECT 'Credit follow-ups table' AS check_name, to_regclass('public.charis_credit_followups') IS NOT NULL AS passed
UNION ALL SELECT 'Staff notifications table', to_regclass('public.charis_staff_notifications') IS NOT NULL
UNION ALL SELECT 'Follow-up RPC', to_regprocedure('public.charis_credit_followup_create(uuid,uuid,uuid,timestamp with time zone,text,text,uuid)') IS NOT NULL
UNION ALL SELECT 'Follow-up status RPC', to_regprocedure('public.charis_credit_followup_status(uuid,uuid,text)') IS NOT NULL
UNION ALL SELECT 'Notification read RPC', to_regprocedure('public.charis_staff_notification_read(uuid,uuid)') IS NOT NULL
UNION ALL SELECT 'Follow-up RLS policy', EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='charis_credit_followups' AND policyname='charis_credit_followups_read_033')
UNION ALL SELECT 'Notification recipient-only RLS policy', EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='charis_staff_notifications' AND policyname='charis_staff_notifications_own_033')
UNION ALL SELECT 'Credit follow-up permissions', (SELECT count(*)=3 FROM public.charis_permission_catalog WHERE permission_key IN('credit_followups.view','credit_followups.create','credit_followups.manage'));
