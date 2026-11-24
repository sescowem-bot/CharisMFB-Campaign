-- Charis Migration 051: email-first contact imports with optional phone numbers.
-- Apply after migration 050. Existing contact, consent, suppression and audit safeguards remain in place.
BEGIN;

DO $migration$
DECLARE
  v_oid regprocedure;
  v_def text;
  v_original text;
BEGIN
  v_oid := to_regprocedure('public.charis_import_consented_batch(uuid,uuid,jsonb,jsonb,uuid)');
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'Migration 041 is required before migration 051';
  END IF;

  v_def := pg_get_functiondef(v_oid);
  v_original := v_def;

  -- Phone-format failures are no longer row-rejection reasons because the phone is optional.
  v_def := replace(
    v_def,
    $old$  ELSIF v_phone IS NOT NULL AND v_phone !~ '^\+[1-9][0-9]{7,14}$' THEN v_reason:='invalid_phone';$old$,
    ''
  );

  -- Existing phone matches must not block an email-led import.
  v_def := replace(
    v_def,
    $old$  ELSIF v_phone IS NOT NULL AND EXISTS(SELECT 1 FROM public.contacts c WHERE c.organization_id=p_org AND c.phone=v_phone) THEN
   v_reason:='existing_phone';$old$,
    ''
  );

  -- A missing or invalid optional phone is discarded before validation and duplicate checks.
  v_def := replace(
    v_def,
    $old$v_phone:=nullif(btrim(coalesce(v_row->>'phone','')),'');$old$,
    $new$v_phone:=nullif(btrim(coalesce(v_row->>'phone','')),'');
  IF v_phone IS NOT NULL AND v_phone !~ '^\+[1-9][0-9]{7,14}$' THEN v_phone:=NULL; END IF;
  -- A phone already assigned to another customer must not block an email-led import.
  IF v_phone IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.contacts c WHERE c.organization_id=p_org AND c.phone=v_phone
  ) THEN v_phone:=NULL; END IF;$new$
  );

  -- Every imported customer must have a valid email; phone alone is not an identity.
  v_def := replace(
    v_def,
    $old$ELSIF v_email IS NULL AND v_phone IS NULL THEN v_reason:='missing_identity';$old$,
    $new$ELSIF v_email IS NULL THEN v_reason:='missing_identity';$new$
  );

  IF v_def = v_original
     OR position('IF v_phone IS NOT NULL AND v_phone !~' in v_def) = 0
     OR position('ELSIF v_email IS NULL THEN v_reason:=' in v_def) = 0
     OR position('invalid_phone' in v_def) > 0
     OR position('existing_phone' in v_def) > 0 THEN
    RAISE EXCEPTION 'Could not safely update the contact import validation rules';
  END IF;

  EXECUTE v_def;
END;
$migration$;

COMMIT;
