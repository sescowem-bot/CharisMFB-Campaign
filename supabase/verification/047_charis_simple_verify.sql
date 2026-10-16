-- Read-only verification: run as a SINGLE complete query after Migration 047.
SELECT
 to_regclass('public.charis_direct_settings') IS NOT NULL AS settings_table,
 to_regclass('public.charis_direct_messages') IS NOT NULL AS messages_table,
 to_regclass('public.charis_direct_recipients') IS NOT NULL AS recipients_table,
 to_regclass('public.charis_direct_provider_prefs') IS NOT NULL AS provider_preferences_table,
 to_regprocedure('public.charis_direct_can_send(uuid)') IS NOT NULL AS staff_send_access_function,
 to_regprocedure('public.charis_direct_create(uuid,uuid,text,text,text,text,text,text,text,uuid[],uuid)') IS NOT NULL AS create_function,
 to_regprocedure('public.charis_direct_claim(uuid,uuid)') IS NOT NULL AS safe_claim_function,
 to_regprocedure('public.charis_direct_finish(uuid,text,text,text,text)') IS NOT NULL AS finish_function;
