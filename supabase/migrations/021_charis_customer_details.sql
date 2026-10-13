-- Charis Migration 021: Save limited, auditable custom customer details.
-- Additive: preserves records, RLS, and existing contact functions.
-- Run once after migrations 001-020, after a database backup.
BEGIN;
CREATE OR REPLACE FUNCTION public.charis_save_contact_with_details(
 p_org uuid,p_id uuid,p_first text,p_last text,p_email text,p_phone text,
 p_consent text,p_evidence text,p_details jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; item record; v_count integer;
BEGIN
 IF NOT public.can_manage_contacts(p_org) THEN RAISE EXCEPTION 'Customer-management permission required'; END IF;
 IF p_details IS NULL OR jsonb_typeof(p_details)<>'object' OR length(p_details::text)>4000 THEN
  RAISE EXCEPTION 'Customer details must be a small object'; END IF;
 SELECT count(*) INTO v_count FROM jsonb_each(p_details);
 IF v_count>12 THEN RAISE EXCEPTION 'Maximum 12 extra customer fields'; END IF;
 FOR item IN SELECT key,value FROM jsonb_each(p_details) LOOP
  IF item.key !~ '^[a-z][a-z0-9_]{0,39}$' OR item.key IN ('id','organization_id','constructor','__proto__','prototype')
    OR item.key ~ '(password|pin|otp|bvn|nin|cvv|card_number|secret|token)' THEN
   RAISE EXCEPTION 'Invalid or restricted customer field'; END IF;
  IF jsonb_typeof(item.value)<>'string' OR length(item.value #>> '{}')>200 THEN
   RAISE EXCEPTION 'Customer detail values must be text of 200 characters or less'; END IF;
  IF item.key IN ('account_number','account_no','account_reference') AND
    length(regexp_replace(item.value #>> '{}','[^0-9]','','g'))>4 THEN
   RAISE EXCEPTION 'Store only the last four digits of an account reference'; END IF;
 END LOOP;
 v_id:=public.save_contact(p_org,p_id,p_first,p_last,p_email,p_phone,p_consent,p_evidence);
 UPDATE public.contacts SET attributes=p_details,updated_at=now()
 WHERE organization_id=p_org AND id=v_id;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'contact.custom_fields_saved','contact',v_id::text,
 jsonb_build_object('fields', (SELECT coalesce(jsonb_agg(key),'[]'::jsonb) FROM jsonb_object_keys(p_details) key)));
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.charis_save_contact_with_details(uuid,uuid,text,text,text,text,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_save_contact_with_details(uuid,uuid,text,text,text,text,text,text,jsonb) TO authenticated;
COMMIT;
