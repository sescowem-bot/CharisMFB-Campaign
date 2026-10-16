-- Read-only verification. Execute after migration 049.
SELECT
  to_regclass('public.charis_direct_messages') IS NOT NULL AS messages_table_present,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='charis_direct_messages' AND column_name='archived_at'
  ) AS message_archive_available,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='charis_direct_staff_rules' AND column_name='can_manage_history'
  ) AS delegated_management_available,
  to_regprocedure('public.charis_direct_can_manage_history(uuid)') IS NOT NULL AS history_permission_function,
  to_regprocedure('public.charis_direct_history_access_save(uuid,uuid,boolean)') IS NOT NULL AS permission_assignment_function,
  to_regprocedure('public.charis_direct_history_manage(uuid,uuid,text)') IS NOT NULL AS history_management_function;
