-- RELEASE 043 | Read-only verification. Run after migration 043.
SELECT 'credit_email_claim_rpc' AS check_name,to_regprocedure('public.charis_credit_email_claim_043(uuid,uuid)') IS NOT NULL AS present
UNION ALL SELECT 'credit_email_finish_rpc',to_regprocedure('public.charis_credit_email_finish_043(uuid,uuid,text,text,text)') IS NOT NULL
UNION ALL SELECT 'brevo_credit_event_rpc',to_regprocedure('public.charis_brevo_credit_event_043(text,text,text,timestamptz)') IS NOT NULL
UNION ALL SELECT 'staff_test_reservation_rpc',to_regprocedure('public.charis_brevo_staff_test_reserve_043(uuid)') IS NOT NULL
UNION ALL SELECT 'staff_due_alert_rpc',to_regprocedure('public.charis_staff_due_alerts_043(uuid)') IS NOT NULL
UNION ALL SELECT 'credit_dispatch_table',to_regclass('public.charis_credit_email_dispatches') IS NOT NULL
UNION ALL SELECT 'brevo_staff_test_table',to_regclass('public.charis_brevo_staff_tests_043') IS NOT NULL
UNION ALL SELECT 'credit_brevo_events_table',to_regclass('public.charis_credit_brevo_events_043') IS NOT NULL;
SELECT p.permission_key,p.label,p.category FROM public.charis_permission_catalog p WHERE p.permission_key='credit_reminders.dispatch';
SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN('charis_credit_email_dispatches','charis_brevo_staff_tests_043','charis_credit_brevo_events_043');
-- Note: Do NOT copy staff, recipient addresses, loan details or keys into support chats.
