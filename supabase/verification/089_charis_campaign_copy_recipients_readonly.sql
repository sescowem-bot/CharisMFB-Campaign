-- Read-only verification for migration 089.
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='charis_direct_messages'
  AND column_name IN ('cc_emails','bcc_emails')
ORDER BY column_name;

SELECT
  to_regprocedure('public.charis_direct_create_provider_089(uuid,uuid,text,text,text,text,text,text,text,uuid[],uuid,jsonb,timestamptz,text,text[],text[])') IS NOT NULL
    AS copy_recipient_rpc_exists,
  has_function_privilege('authenticated',
    'public.charis_direct_create_provider_089(uuid,uuid,text,text,text,text,text,text,text,uuid[],uuid,jsonb,timestamptz,text,text[],text[])',
    'EXECUTE') AS authenticated_can_create_campaign,
  has_function_privilege('anon',
    'public.charis_direct_create_provider_089(uuid,uuid,text,text,text,text,text,text,text,uuid[],uuid,jsonb,timestamptz,text,text[],text[])',
    'EXECUTE') AS anonymous_can_create_campaign;

SELECT
  tablename,
  has_table_privilege('anon','public.'||tablename,'SELECT') AS anon_can_select,
  has_table_privilege('authenticated','public.'||tablename,'SELECT') AS authenticated_can_select
FROM pg_tables
WHERE schemaname='public' AND tablename LIKE 'charis_zoho_%'
ORDER BY tablename;

SELECT conname
FROM pg_constraint
WHERE conrelid='public.charis_direct_messages'::regclass
  AND conname='charis_direct_copy_recipients_089';
