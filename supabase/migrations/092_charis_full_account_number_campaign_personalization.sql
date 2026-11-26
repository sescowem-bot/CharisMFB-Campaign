-- Charis Migration 092: retain complete account numbers for approved campaign personalization.
-- This removes the legacy last-four-digits restriction from the guarded contact-detail RPC.
-- Apply after migration 091. Existing stored values are not reconstructed or changed.
BEGIN;

DO $migration$
DECLARE
  v_oid regprocedure;
  v_def text;
  v_original text;
BEGIN
  v_oid := to_regprocedure('public.charis_save_contact_with_details(uuid,uuid,text,text,text,text,text,text,jsonb)');
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'Migration 021 is required before migration 092';
  END IF;

  v_def := pg_get_functiondef(v_oid);
  v_original := v_def;

  v_def := replace(
    v_def,
    $restriction$  IF item.key IN ('account_number','account_no','account_reference') AND
    length(regexp_replace(item.value #>> '{}','[^0-9]','','g'))>4 THEN
   RAISE EXCEPTION 'Store only the last four digits of an account reference'; END IF;$restriction$,
    ''
  );

  IF v_def = v_original AND position('Store only the last four digits of an account reference' IN v_def) > 0 THEN
    RAISE EXCEPTION 'Could not safely remove the legacy account-number restriction';
  END IF;

  EXECUTE v_def;
END;
$migration$;

COMMIT;
