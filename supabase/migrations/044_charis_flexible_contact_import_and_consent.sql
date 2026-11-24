-- Charis Migration 044: lighter staff consent confirmation and flexible customer attributes.
-- Updates existing security-definer functions without changing their authorization or audit behaviour.
-- Apply after migration 043. Back up the database before applying.
BEGIN;

DO $migration$
DECLARE
  v_def text;
  v_original text;
  v_oid regprocedure;
BEGIN
  v_oid := to_regprocedure('public.charis_save_contact_with_details(uuid,uuid,text,text,text,text,text,text,jsonb)');
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'Migration 021 is required before migration 044';
  END IF;
  v_def := pg_get_functiondef(v_oid);
  v_original := v_def;
  v_def := replace(v_def, 'length(p_details::text)>4000', 'length(p_details::text)>16000');
  v_def := replace(v_def, 'v_count>12', 'v_count>56');
  IF v_def = v_original OR position('v_count>56' in v_def) = 0 OR position('length(p_details::text)>16000' in v_def) = 0 THEN
    RAISE EXCEPTION 'Could not safely expand custom contact detail limits in migration 021 function';
  END IF;
  EXECUTE v_def;

  v_oid := to_regprocedure('public.charis_import_consented_batch(uuid,uuid,jsonb,jsonb,uuid)');
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'Migration 041 is required before migration 044';
  END IF;
  v_def := pg_get_functiondef(v_oid);
  v_original := v_def;
  v_def := replace(v_def, 'length(v_attributes::text)>4000', 'length(v_attributes::text)>16000');
  v_def := replace(v_def, '(SELECT count(*) FROM jsonb_object_keys(v_attributes))>12', '(SELECT count(*) FROM jsonb_object_keys(v_attributes))>56');
  IF v_def = v_original OR position('jsonb_object_keys(v_attributes))>56' in v_def) = 0 OR position('length(v_attributes::text)>16000' in v_def) = 0 THEN
    RAISE EXCEPTION 'Could not safely expand import attribute limits in migration 041 function';
  END IF;
  EXECUTE v_def;
END;
$migration$;

COMMIT;
