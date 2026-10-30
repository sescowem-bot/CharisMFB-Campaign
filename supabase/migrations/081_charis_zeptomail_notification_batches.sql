-- 081: Add ZeptoMail notifications to the EXISTING Charis direct campaign queue.
-- Only run in CHARIS database after migrations 060 and 075.
BEGIN;
ALTER TABLE public.charis_direct_messages ADD COLUMN IF NOT EXISTS zepto_event_reference text;
ALTER TABLE public.charis_direct_messages DROP CONSTRAINT IF EXISTS charis_direct_preferred_provider_075;
ALTER TABLE public.charis_direct_messages ADD CONSTRAINT charis_direct_preferred_provider_075
 CHECK (preferred_provider IS NULL OR (
  channel='email' AND preferred_provider IN ('resend','brevo','mailjet','zeptomail')
  AND (preferred_provider<>'zeptomail' OR
   (purpose='account_update' AND zepto_event_reference IS NOT NULL AND length(trim(zepto_event_reference)) BETWEEN 4 AND 120))
 ));
CREATE OR REPLACE FUNCTION public.charis_direct_create_zepto_081(
 p_org uuid,p_key uuid,p_title text,p_subject text,p_body text,p_purpose text,
 p_product text,p_channel text,p_audience text,p_contact_ids uuid[],p_list uuid,
 p_design jsonb,p_scheduled_at timestamptz,p_reference text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;v_existing uuid;v_provider text;v_reference text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.charis_direct_can_send(p_org) OR
  NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=p_org AND slug='charis-mfb' AND status='active')
 THEN RAISE EXCEPTION 'Charis communication permission required.'; END IF;
 IF p_channel<>'email' OR p_purpose<>'account_update' OR p_audience<>'selected' OR
  p_list IS NOT NULL OR coalesce(array_length(p_contact_ids,1),0) NOT BETWEEN 1 AND 50 OR
  length(trim(coalesce(p_reference,''))) NOT BETWEEN 4 AND 120
 THEN RAISE EXCEPTION 'Zoho is limited to 1–50 selected customers with a real bank event reference.'; END IF;
 SELECT id,preferred_provider,zepto_event_reference INTO v_existing,v_provider,v_reference
 FROM public.charis_direct_messages WHERE organization_id=p_org AND idempotency_key=p_key;
 IF v_existing IS NOT NULL THEN
  IF v_provider IS DISTINCT FROM 'zeptomail' OR v_reference IS DISTINCT FROM trim(p_reference)
   THEN RAISE EXCEPTION 'This campaign was already submitted with different notification details.'; END IF;
  RETURN v_existing;
 END IF;
 v_id:=public.charis_direct_create_v2(
  p_org,p_key,p_title,p_subject,p_body,p_purpose,p_product,p_channel,
  p_audience,p_contact_ids,p_list,p_design,p_scheduled_at
 );
 UPDATE public.charis_direct_messages
 SET preferred_provider='zeptomail',zepto_event_reference=trim(p_reference)
 WHERE id=v_id AND organization_id=p_org AND created_by=auth.uid()
  AND status IN ('queued','pending_approval');
 IF NOT FOUND THEN RAISE EXCEPTION 'Unable to reserve the ZeptoMail provider before sending.'; END IF;
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.charis_direct_create_zepto_081(
 uuid,uuid,text,text,text,text,text,text,text,uuid[],uuid,jsonb,timestamptz,text
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_direct_create_zepto_081(
 uuid,uuid,text,text,text,text,text,text,text,uuid[],uuid,jsonb,timestamptz,text
) TO authenticated;
COMMIT;
