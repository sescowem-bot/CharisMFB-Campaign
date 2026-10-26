-- Release 077: audit and idempotency for one-to-one, human-initiated Zoho correspondence.
-- Apply to Charis Supabase after migration 047. Independent of optional migration 075.
-- No scheduled workers, bulk email or mail credentials are created here.
BEGIN;

CREATE TABLE IF NOT EXISTS public.charis_zoho_manual_letters (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 request_nonce uuid NOT NULL,
 sender_email text NOT NULL,
 recipient_email text NOT NULL,
 subject text NOT NULL,
 status text NOT NULL DEFAULT 'reserved'
  CHECK(status IN ('reserved','accepted','uncertain')),
 provider_message_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,actor_id,request_nonce)
);
CREATE INDEX IF NOT EXISTS charis_zoho_manual_recent_077
 ON public.charis_zoho_manual_letters(organization_id,actor_id,created_at DESC);
ALTER TABLE public.charis_zoho_manual_letters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charis_zoho_manual_letters FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.charis_zoho_manual_letters TO authenticated;

DROP POLICY IF EXISTS charis_zoho_manual_view_077 ON public.charis_zoho_manual_letters;
CREATE POLICY charis_zoho_manual_view_077 ON public.charis_zoho_manual_letters
 FOR SELECT TO authenticated USING (
  organization_id IN (SELECT id FROM public.organizations WHERE slug='charis-mfb')
  AND (actor_id=(SELECT auth.uid()) OR public.charis_direct_is_admin(organization_id))
 );

CREATE OR REPLACE FUNCTION public.charis_zoho_manual_reserve_077(
 p_org uuid,p_nonce uuid,p_sender text,p_to text,p_subject text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;v_last timestamptz;v_count integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.charis_direct_can_send(p_org) THEN
  RAISE EXCEPTION 'Bank correspondence permission required.';
 END IF;
 IF lower(trim(p_sender)) IS DISTINCT FROM lower(coalesce(auth.jwt()->>'email','')) THEN
  RAISE EXCEPTION 'Only your own verified bank mailbox may be used.';
 END IF;
 IF length(p_sender)>254 OR length(p_to)>254
    OR p_to !~* '^[a-z0-9._%+''-]+@[a-z0-9.-]+\.[a-z]{2,}$'
    OR p_sender !~* '^[a-z0-9._%+''-]+@[a-z0-9.-]+\.[a-z]{2,}$'
    OR length(trim(p_subject)) NOT BETWEEN 3 AND 160 THEN
  RAISE EXCEPTION 'Review the recipient and email subject.';
 END IF;
 -- Protect against simultaneous browser posts and distributed serverless instances.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_org::text||':'||auth.uid()::text,0));
 IF EXISTS(SELECT 1 FROM public.charis_zoho_manual_letters
  WHERE organization_id=p_org AND actor_id=auth.uid() AND request_nonce=p_nonce) THEN
  RAISE EXCEPTION 'This email has already been submitted. Check your mail history before sending again.';
 END IF;
 SELECT max(created_at),count(*) FILTER (WHERE created_at>now()-interval '1 day')
 INTO v_last,v_count FROM public.charis_zoho_manual_letters
 WHERE organization_id=p_org AND actor_id=auth.uid();
 IF v_last>now()-interval '60 seconds' THEN
  RAISE EXCEPTION 'Wait at least one minute between individual client emails.';
 END IF;
 IF v_count>=20 THEN
  RAISE EXCEPTION 'Daily safety limit reached for individual business emails. Use an approved mailing platform for larger volumes.';
 END IF;
 INSERT INTO public.charis_zoho_manual_letters(
  organization_id,actor_id,request_nonce,sender_email,recipient_email,subject
 ) VALUES(
  p_org,auth.uid(),p_nonce,lower(trim(p_sender)),lower(trim(p_to)),trim(p_subject)
 ) RETURNING id INTO v_id;
 RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.charis_zoho_manual_complete_077(
 p_org uuid,p_id uuid,p_status text,p_provider_id text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.charis_direct_can_send(p_org)
    OR p_status NOT IN ('accepted','uncertain') THEN
  RAISE EXCEPTION 'Unable to update manual email delivery record.';
 END IF;
 UPDATE public.charis_zoho_manual_letters
 SET status=p_status,updated_at=now(),provider_message_id=left(coalesce(p_provider_id,''),250)
 WHERE organization_id=p_org AND id=p_id AND actor_id=auth.uid() AND status='reserved';
 RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.charis_zoho_manual_reserve_077(uuid,uuid,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.charis_zoho_manual_complete_077(uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_zoho_manual_reserve_077(uuid,uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.charis_zoho_manual_complete_077(uuid,uuid,text,text) TO authenticated;
COMMIT;
