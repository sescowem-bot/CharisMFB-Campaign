-- Release 079: guarded, human-initiated single-recipient transactional ZeptoMail delivery.
-- Apply to the Charis database after migration 047; independent of 075 and 077.
BEGIN;
CREATE TABLE IF NOT EXISTS public.charis_zeptomail_notices(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 request_nonce uuid NOT NULL,
 from_email text NOT NULL,
 recipient_email text NOT NULL,
 purpose text NOT NULL CHECK(purpose IN ('loan_reminder','account_notice','payment_receipt','customer_request')),
 related_reference text NOT NULL,
 subject text NOT NULL,
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','accepted','uncertain')),
 provider_message_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,actor_id,request_nonce)
);
CREATE INDEX IF NOT EXISTS charis_zepto_recent_079 ON public.charis_zeptomail_notices(organization_id,actor_id,created_at DESC);
ALTER TABLE public.charis_zeptomail_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charis_zeptomail_notices FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.charis_zeptomail_notices TO authenticated;
DROP POLICY IF EXISTS charis_zepto_view_079 ON public.charis_zeptomail_notices;
CREATE POLICY charis_zepto_view_079 ON public.charis_zeptomail_notices FOR SELECT TO authenticated USING (
 organization_id IN (SELECT id FROM public.organizations WHERE slug='charis-mfb')
 AND (actor_id=(SELECT auth.uid()) OR public.charis_direct_is_admin(organization_id))
);
CREATE OR REPLACE FUNCTION public.charis_zepto_reserve_079(
 p_org uuid,p_nonce uuid,p_from text,p_to text,p_subject text,p_purpose text,p_reference text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_latest timestamptz; v_count integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.charis_direct_can_send(p_org) OR
  NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=p_org AND slug='charis-mfb') THEN
  RAISE EXCEPTION 'Charis sender permission required.';
 END IF;
 IF lower(trim(split_part(p_from,'@',2)))<>'charismfb.com'
  OR p_from !~* '^[a-z0-9._%+''-]+@charismfb\.com$'
  OR p_to !~* '^[a-z0-9._%+''-]+@[a-z0-9.-]+\.[a-z]{2,}$'
  OR p_purpose NOT IN ('loan_reminder','account_notice','payment_receipt','customer_request')
  OR length(trim(p_subject)) NOT BETWEEN 5 AND 160
  OR length(trim(p_reference)) NOT BETWEEN 4 AND 120
 THEN RAISE EXCEPTION 'Review bank sender, recipient, reference and notification type.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_org::text||':'||auth.uid()::text||':zepto',0));
 IF EXISTS(SELECT 1 FROM public.charis_zeptomail_notices
  WHERE organization_id=p_org AND actor_id=auth.uid() AND request_nonce=p_nonce)
 THEN RAISE EXCEPTION 'This notification has already been submitted. Check its delivery status.'; END IF;
 SELECT max(created_at),count(*) FILTER(WHERE created_at>now()-interval '1 day')
 INTO v_latest,v_count FROM public.charis_zeptomail_notices
 WHERE organization_id=p_org AND actor_id=auth.uid();
 IF v_latest>now()-interval '60 seconds' THEN
  RAISE EXCEPTION 'Wait one minute before sending another individual notice.';
 END IF;
 IF v_count>=20 THEN
  RAISE EXCEPTION 'Daily limit for manual transactional notices reached.';
 END IF;
 INSERT INTO public.charis_zeptomail_notices(
  organization_id,actor_id,request_nonce,from_email,recipient_email,purpose,related_reference,subject
 ) VALUES(p_org,auth.uid(),p_nonce,lower(trim(p_from)),lower(trim(p_to)),p_purpose,trim(p_reference),trim(p_subject))
 RETURNING id INTO v_id;
 RETURN v_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.charis_zepto_complete_079(p_org uuid,p_id uuid,p_status text,p_provider_id text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.charis_direct_can_send(p_org)
  OR p_status NOT IN ('accepted','uncertain') THEN
  RAISE EXCEPTION 'Unable to update transactional notification status.';
 END IF;
 UPDATE public.charis_zeptomail_notices SET
  status=p_status,provider_message_id=left(coalesce(p_provider_id,''),250),updated_at=now()
 WHERE organization_id=p_org AND id=p_id AND actor_id=auth.uid() AND status='reserved';
 RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.charis_zepto_reserve_079(uuid,uuid,text,text,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.charis_zepto_complete_079(uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_zepto_reserve_079(uuid,uuid,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.charis_zepto_complete_079(uuid,uuid,text,text) TO authenticated;
COMMIT;
