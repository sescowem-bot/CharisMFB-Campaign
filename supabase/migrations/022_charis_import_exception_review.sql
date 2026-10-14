-- Charis Migration 022: Reviewable exceptions for new customer imports.
-- Requires 001-021. Run once after backing up the existing database.
-- Existing import totals are preserved. Old exception rows cannot be reconstructed.
BEGIN;
CREATE TABLE IF NOT EXISTS public.contact_import_issues (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 batch_id uuid NOT NULL REFERENCES public.contact_import_batches(id) ON DELETE CASCADE,
 source_row integer NOT NULL CHECK(source_row BETWEEN 2 AND 5001),
 issue_type text NOT NULL CHECK(issue_type IN ('duplicate','invalid')),
 reason_code text NOT NULL CHECK(reason_code IN ('existing_email','existing_phone','invalid_attributes','missing_identity','invalid_email','invalid_phone','invalid_name','invalid_row','concurrent_duplicate')),
 first_name text NOT NULL DEFAULT '',
 last_name text NOT NULL DEFAULT '',
 email text,
 phone text,
 resolution text NOT NULL DEFAULT 'unresolved' CHECK(resolution IN ('unresolved','reviewed','corrected','kept_existing')),
 resolved_at timestamptz,
 resolved_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(batch_id,source_row)
);
CREATE INDEX IF NOT EXISTS contact_import_issues_org_batch ON public.contact_import_issues(organization_id,batch_id);
ALTER TABLE public.contact_import_issues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authorized Charis staff review import issues" ON public.contact_import_issues;
CREATE POLICY "Authorized Charis staff review import issues" ON public.contact_import_issues
 FOR SELECT TO authenticated USING(public.can_manage_contacts(organization_id));
REVOKE ALL ON public.contact_import_issues FROM PUBLIC,anon;
GRANT SELECT ON public.contact_import_issues TO authenticated;

-- Maintain exactly the original import RPC signature, idempotency, counters,
-- consent defaults and group membership integration. Record only rejected and
-- duplicate input identity fields, never extra attributes or credentials.
CREATE OR REPLACE FUNCTION public.import_contact_batch(p_org uuid,p_batch_key uuid,p_rows jsonb)
RETURNS TABLE(inserted integer,skipped integer,rejected integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_id uuid; v_row jsonb; v_email text; v_phone text; v_first text; v_last text;
 v_inserted integer:=0; v_skipped integer:=0; v_rejected integer:=0; v_rows_count integer;
 v_attributes jsonb; v_source_row integer; v_pos integer:=0; v_reason text;
BEGIN
 IF NOT public.can_manage_contacts(p_org) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF p_batch_key IS NULL OR p_rows IS NULL OR jsonb_typeof(p_rows)<>'array' THEN RAISE EXCEPTION 'Invalid import request'; END IF;
 v_rows_count:=jsonb_array_length(p_rows);
 IF v_rows_count<1 OR v_rows_count>100 OR length(p_rows::text)>100000 THEN RAISE EXCEPTION 'Batch exceeds import limits'; END IF;
 INSERT INTO public.contact_import_batches(organization_id,batch_key,imported_by)
 VALUES(p_org,p_batch_key,auth.uid()) ON CONFLICT(organization_id,batch_key) DO NOTHING RETURNING id INTO v_id;
 IF v_id IS NULL THEN
  RETURN QUERY SELECT b.inserted_count,b.skipped_count,b.rejected_count
   FROM public.contact_import_batches b WHERE b.organization_id=p_org AND b.batch_key=p_batch_key;
  RETURN;
 END IF;
 FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  v_pos:=v_pos+1;
  v_source_row:=CASE WHEN (v_row->>'source_row') ~ '^[0-9]{1,5}$'
   THEN (v_row->>'source_row')::integer ELSE v_pos+1 END;
  IF v_source_row NOT BETWEEN 2 AND 5001 THEN v_source_row:=v_pos+1; END IF;
  v_email:=nullif(lower(btrim(coalesce(v_row->>'email',''))),'');
  v_phone:=nullif(btrim(coalesce(v_row->>'phone','')),'');
  v_first:=btrim(coalesce(v_row->>'first_name',''));
  v_last:=btrim(coalesce(v_row->>'last_name',''));
  v_attributes:=coalesce(v_row->'attributes','{}'::jsonb);
  v_reason:=null;
  IF jsonb_typeof(v_row)<>'object' THEN v_reason:='invalid_row';
  ELSIF jsonb_typeof(v_attributes)<>'object' OR length(v_attributes::text)>4000 THEN v_reason:='invalid_attributes';
  ELSIF (SELECT count(*) FROM jsonb_object_keys(v_attributes))>12 OR
   EXISTS(SELECT 1 FROM jsonb_each(v_attributes) a WHERE a.key !~ '^[a-z][a-z0-9_]{0,39}$'
    OR jsonb_typeof(a.value)<>'string' OR length(a.value#>>'{}')>500) THEN v_reason:='invalid_attributes';
  ELSIF v_email IS NULL AND v_phone IS NULL THEN v_reason:='missing_identity';
  ELSIF v_email IS NOT NULL AND (length(v_email)>254 OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') THEN v_reason:='invalid_email';
  ELSIF v_phone IS NOT NULL AND v_phone !~ '^\+[1-9][0-9]{7,14}$' THEN v_reason:='invalid_phone';
  ELSIF length(v_first)>100 OR length(v_last)>100 THEN v_reason:='invalid_name';
  END IF;
  IF v_reason IS NOT NULL THEN
   v_rejected:=v_rejected+1;
   INSERT INTO public.contact_import_issues(organization_id,batch_id,source_row,issue_type,reason_code,first_name,last_name,email,phone)
    VALUES(p_org,v_id,v_source_row,'invalid',v_reason,left(v_first,100),left(v_last,100),left(coalesce(v_email,''),254),left(coalesce(v_phone,''),20));
   CONTINUE;
  END IF;
  IF v_email IS NOT NULL AND EXISTS(SELECT 1 FROM public.contacts c WHERE c.organization_id=p_org AND c.email=v_email) THEN
   v_reason:='existing_email';
  ELSIF v_phone IS NOT NULL AND EXISTS(SELECT 1 FROM public.contacts c WHERE c.organization_id=p_org AND c.phone=v_phone) THEN
   v_reason:='existing_phone';
  END IF;
  IF v_reason IS NOT NULL THEN
   v_skipped:=v_skipped+1;
   INSERT INTO public.contact_import_issues(organization_id,batch_id,source_row,issue_type,reason_code,first_name,last_name,email,phone)
    VALUES(p_org,v_id,v_source_row,'duplicate',v_reason,left(v_first,100),left(v_last,100),v_email,v_phone);
   CONTINUE;
  END IF;
  BEGIN
   INSERT INTO public.contacts(organization_id,first_name,last_name,email,phone,source,consent_status,attributes,created_by)
    VALUES(p_org,v_first,v_last,v_email,v_phone,'import','unknown',v_attributes,auth.uid());
   v_inserted:=v_inserted+1;
  EXCEPTION WHEN unique_violation THEN
   v_skipped:=v_skipped+1;
   INSERT INTO public.contact_import_issues(organization_id,batch_id,source_row,issue_type,reason_code,first_name,last_name,email,phone)
    VALUES(p_org,v_id,v_source_row,'duplicate','concurrent_duplicate',left(v_first,100),left(v_last,100),v_email,v_phone);
  END;
 END LOOP;
 UPDATE public.contact_import_batches b SET inserted_count=v_inserted,skipped_count=v_skipped,rejected_count=v_rejected WHERE b.id=v_id;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
  VALUES(p_org,auth.uid(),'contacts.import_batch','contact_import_batch',v_id::text,
   jsonb_build_object('inserted',v_inserted,'skipped',v_skipped,'rejected',v_rejected));
 RETURN QUERY SELECT v_inserted,v_skipped,v_rejected;
END;$$;
REVOKE ALL ON FUNCTION public.import_contact_batch(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.import_contact_batch(uuid,uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_review_import_issue(p_org uuid,p_issue uuid,p_resolution text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_count integer;
BEGIN
 IF NOT public.can_manage_contacts(p_org) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF p_resolution NOT IN ('reviewed','corrected','kept_existing') THEN RAISE EXCEPTION 'Invalid review decision'; END IF;
 UPDATE public.contact_import_issues SET resolution=p_resolution,resolved_at=now(),resolved_by=auth.uid()
  WHERE id=p_issue AND organization_id=p_org AND resolution='unresolved';
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count>0 THEN
  INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
   VALUES(p_org,auth.uid(),'contacts.import_issue_reviewed','contact_import_issue',p_issue::text,
    jsonb_build_object('resolution',p_resolution));
 END IF;
 RETURN v_count>0;
END;$$;
REVOKE ALL ON FUNCTION public.charis_review_import_issue(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_review_import_issue(uuid,uuid,text) TO authenticated;
COMMIT;
