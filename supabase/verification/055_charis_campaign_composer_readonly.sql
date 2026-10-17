-- Read-only SQL 055 verification. Execute after installation in Supabase SQL Editor.
SELECT 'design_column' check_name, EXISTS(
 SELECT 1 FROM information_schema.columns
 WHERE table_schema='public' AND table_name='charis_direct_messages' AND column_name='design'
) installed
UNION ALL
SELECT 'scheduled_at_column', EXISTS(
 SELECT 1 FROM information_schema.columns
 WHERE table_schema='public' AND table_name='charis_direct_messages' AND column_name='scheduled_at'
)
UNION ALL
SELECT 'create_v2', to_regprocedure('public.charis_direct_create_v2(uuid,uuid,text,text,text,text,text,text,text,uuid[],uuid,jsonb,timestamptz)') IS NOT NULL
UNION ALL
SELECT 'cancel_scheduled', to_regprocedure('public.charis_direct_cancel_scheduled(uuid,uuid)') IS NOT NULL;
-- NOTE: This does not verify that the worker is scheduled or that any provider sends.
