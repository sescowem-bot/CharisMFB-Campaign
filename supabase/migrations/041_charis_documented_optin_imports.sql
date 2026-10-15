-- Charis 041: verified opt-in imports and existing suppression preservation.
-- Apply after 040. Does NOT resubscribe declined or unsubscribed customers.
-- Promotional eligibility requires both explicit prior proof and bank/provider suppression checks.
BEGIN;
ALTER TABLE public.contact_import_issues DROP CONSTRAINT IF EXISTS contact_import_issues_reason_code_check;
ALTER TABLE public.contact_import_issues ADD CONSTRAINT contact_import_issues_reason_code_check CHECK(reason_code IN
 ('existing_email','existing_phone','invalid_attributes','missing_identity','invalid_email','invalid_phone','invalid_name','invalid_row','concurrent_duplicate','suppressed_email'));
CREATE TABLE IF NOT EXISTS public.charis_import_consent_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 batch_id uuid NOT NULL REFERENCES public.contact_import_batches(id),
 contact_id uuid NOT NULL,
 source text NOT NULL,
 reference text NOT NULL,
 recorded_on date NOT NULL,
 permission_scope text NOT NULL CHECK(permission_scope IN ('all_marketing','product_specific')),
 product_name text NOT NULL DEFAULT '',
 imported_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(batch_id,contact_id),
 FOREIGN KEY(organization_id,contact_id) REFERENCES public.contacts(organization_id,id)
);
CREATE INDEX IF NOT EXISTS charis_import_consents_org_batch_idx ON public.charis_import_consent_records(organization_id,batch_id);
ALTER TABLE public.charis_import_consent_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charis_import_consent_records FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.charis_import_consent_records TO authenticated;
DROP POLICY IF EXISTS charis_import_consents_read_041 ON public.charis_import_consent_records;
CREATE POLICY charis_import_consents_read_041 ON public.charis_import_consent_records FOR SELECT TO authenticated
 USING(public.can_manage_contacts(organization_id));

CREATE OR REPLACE FUNCTION public.charis_import_consented_batch(p_org uuid,p_batch_key uuid,p_rows jsonb,p_consent jsonb,p_list uuid DEFAULT NULL)
RETURNS TABLE(inserted integer,skipped integer,rejected integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_id uuid; v_row jsonb; v_email text; v_phone text; v_first text; v_last text;
 v_inserted integer:=0; v_skipped integer:=0; v_rejected integer:=0; v_rows_count integer;
 v_attributes jsonb; v_source_row integer; v_pos integer:=0; v_reason text;
 v_source text; v_reference text; v_scope text; v_product text; v_recorded_on date;
 v_contact uuid; v_new_ids uuid[]:=ARRAY[]::uuid[]; v_grant boolean;
BEGIN
 IF NOT public.can_manage_contacts(p_org) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF p_consent IS NULL OR length(p_consent::text)>1000 OR jsonb_typeof(p_consent)<>'object' OR p_consent->>'confirmed'<>'true' THEN
   RAISE EXCEPTION 'Confirm documented prior marketing consent before importing'; END IF;
 v_source:=p_consent->>'source'; v_reference:=btrim(coalesce(p_consent->>'reference',''));
 v_scope:=p_consent->>'scope'; v_product:=btrim(coalesce(p_consent->>'product',''));
 IF v_source IS NULL OR v_source NOT IN ('signed_form','digital_form','consent_register','recorded_call','other')
  OR length(v_reference) NOT BETWEEN 8 AND 200 OR v_scope IS NULL OR v_scope NOT IN ('all_marketing','product_specific')
  OR length(v_product)>80 OR (v_scope='product_specific' AND length(v_product)<2)
  OR coalesce(p_consent->>'recorded_on','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 THEN RAISE EXCEPTION 'A valid consent source, evidence reference, date and permission scope are required'; END IF;
 BEGIN v_recorded_on:=(p_consent->>'recorded_on')::date;
 EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'Invalid consent date'; END;
 IF v_recorded_on>current_date THEN RAISE EXCEPTION 'Consent date cannot be in the future'; END IF;
 IF p_list IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.contact_lists WHERE organization_id=p_org AND id=p_list)
 THEN RAISE EXCEPTION 'Selected customer group is unavailable';END IF;
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
  IF v_email IS NOT NULL AND EXISTS(SELECT 1 FROM public.email_suppressions s WHERE s.organization_id=p_org AND s.email=v_email) THEN
   v_reason:='suppressed_email';
  ELSIF v_email IS NOT NULL AND EXISTS(SELECT 1 FROM public.contacts c WHERE c.organization_id=p_org AND c.email=v_email) THEN
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
   -- General promotional consent can be granted only for a verified email and an explicit general scope.
   -- Product-specific permission is recorded but cannot be used for general broadcasts.
   v_grant := v_email IS NOT NULL AND v_scope='all_marketing';
   INSERT INTO public.contacts(organization_id,first_name,last_name,email,phone,source,consent_status,consent_evidence,consent_recorded_at,attributes,created_by)
   VALUES(p_org,v_first,v_last,v_email,v_phone,'import',
    CASE WHEN v_grant THEN 'granted' ELSE 'unknown' END,
    CASE WHEN v_grant THEN left('Import evidence: '||v_source||'; register: '||v_reference,500) ELSE NULL END,
    CASE WHEN v_grant THEN v_recorded_on::timestamptz ELSE NULL END,
    v_attributes,auth.uid()) RETURNING id INTO v_contact;
   INSERT INTO public.charis_import_consent_records(organization_id,batch_id,contact_id,source,reference,recorded_on,permission_scope,product_name,imported_by)
   VALUES(p_org,v_id,v_contact,v_source,v_reference,v_recorded_on,v_scope,v_product,auth.uid());
   v_new_ids:=array_append(v_new_ids,v_contact);
   v_inserted:=v_inserted+1;
  EXCEPTION WHEN unique_violation THEN
   v_skipped:=v_skipped+1;
   INSERT INTO public.contact_import_issues(organization_id,batch_id,source_row,issue_type,reason_code,first_name,last_name,email,phone)
    VALUES(p_org,v_id,v_source_row,'duplicate','concurrent_duplicate',left(v_first,100),left(v_last,100),v_email,v_phone);
  END;
 END LOOP;
 IF p_list IS NOT NULL AND array_length(v_new_ids,1)>0 THEN
   INSERT INTO public.contact_list_members(organization_id,list_id,contact_id)
   SELECT p_org,p_list,unnest(v_new_ids)
   ON CONFLICT(list_id,contact_id) DO NOTHING;
 END IF;
 UPDATE public.contact_import_batches b SET inserted_count=v_inserted,skipped_count=v_skipped,rejected_count=v_rejected WHERE b.id=v_id;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
  VALUES(p_org,auth.uid(),'contacts.import_batch','contact_import_batch',v_id::text,
   jsonb_build_object('inserted',v_inserted,'skipped',v_skipped,'rejected',v_rejected,'consent_scope',v_scope,'consent_source',v_source,'product',v_product));
 RETURN QUERY SELECT v_inserted,v_skipped,v_rejected;
END;$$;

REVOKE ALL ON FUNCTION public.charis_import_consented_batch(uuid,uuid,jsonb,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_import_consented_batch(uuid,uuid,jsonb,jsonb,uuid) TO authenticated;
COMMIT;
