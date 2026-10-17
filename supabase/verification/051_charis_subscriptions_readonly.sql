-- No mutations; run after migration 051.
SELECT
 to_regclass('public.charis_subscription_staff_access') IS NOT NULL AS staff_roles_installed,
 to_regclass('public.charis_resubscribe_requests') IS NOT NULL AS verification_requests_installed,
 to_regclass('public.charis_subscription_sync') IS NOT NULL AS provider_sync_installed,
 to_regclass('public.charis_subscription_events') IS NOT NULL AS preference_audit_installed,
 to_regprocedure('public.charis_subscription_delegate(uuid,uuid,boolean,boolean)') IS NOT NULL AS delegation_rpc_installed,
 to_regprocedure('public.charis_subscription_issue(uuid,text,text,text,uuid)') IS NOT NULL AS request_rpc_installed,
 to_regprocedure('public.charis_subscription_confirm(text)') IS NOT NULL AS confirmation_rpc_installed;
