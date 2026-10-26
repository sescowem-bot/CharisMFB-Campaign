-- 075: Safe per-campaign email-provider preference (additive; apply after 060).
-- The original automatic campaign RPC remains available, so old clients continue working.
-- No provider routes, credentials, or existing campaigns are changed by this migration.
BEGIN;

ALTER TABLE public.charis_direct_messages
 ADD COLUMN IF NOT EXISTS preferred_provider text;

DO $$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname='charis_direct_preferred_provider_075'
   AND conrelid='public.charis_direct_messages'::regclass
 ) THEN
  ALTER TABLE public.charis_direct_messages
   ADD CONSTRAINT charis_direct_preferred_provider_075
   CHECK (preferred_provider IS NULL OR (channel='email' AND preferred_provider IN ('resend','brevo','mailjet')));
 END IF;
END;
$$;

-- This wrapper calls the original permission-checked creator and commits the provider
-- preference *atomically* before the worker can claim a campaign's recipients.
CREATE OR REPLACE FUNCTION public.charis_direct_create_provider_075(
 p_org uuid,p_key uuid,p_title text,p_subject text,p_body text,p_purpose text,
 p_product text,p_channel text,p_audience text,p_contact_ids uuid[],p_list uuid,
 p_design jsonb,p_scheduled_at timestamptz,p_provider text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;v_existing uuid;v_old_provider text;
BEGIN
 IF p_provider IS NOT NULL THEN
  IF p_channel<>'email' OR p_provider NOT IN ('resend','brevo','mailjet') THEN
   RAISE EXCEPTION 'Choose a supported email provider.';
  END IF;
  -- Only a currently active, bank-scoped, verified sender may be selected.
  IF NOT EXISTS(
   SELECT 1 FROM public.charis_direct_provider_prefs pref
   JOIN public.sender_identities sender ON sender.organization_id=pref.organization_id
     AND sender.id=pref.sender_id AND sender.is_active
   JOIN public.sending_domains dom ON dom.organization_id=pref.organization_id
     AND dom.id=sender.domain_id AND dom.provider=pref.provider
     AND dom.charis_connected AND dom.verification_status='verified'
   JOIN public.email_provider_settings settings ON settings.provider=pref.provider
     AND settings.enabled AND settings.daily_limit>0
   WHERE pref.organization_id=p_org AND pref.provider=p_provider AND pref.enabled
  ) THEN RAISE EXCEPTION 'This email provider does not have an active verified bank sender.'; END IF;
 END IF;
 SELECT id,preferred_provider INTO v_existing,v_old_provider
 FROM public.charis_direct_messages
 WHERE organization_id=p_org AND idempotency_key=p_key;
 IF FOUND AND v_old_provider IS DISTINCT FROM p_provider THEN
  RAISE EXCEPTION 'Campaign already submitted with a different email provider. Check its status.';
 END IF;
 v_id:=public.charis_direct_create_v2(
  p_org,p_key,p_title,p_subject,p_body,p_purpose,p_product,p_channel,p_audience,
  p_contact_ids,p_list,p_design,p_scheduled_at
 );
 IF v_existing IS NULL THEN
  UPDATE public.charis_direct_messages
  SET preferred_provider=p_provider
  WHERE id=v_id AND organization_id=p_org
    AND created_by=auth.uid() AND status IN ('queued','pending_approval');
  IF NOT FOUND THEN RAISE EXCEPTION 'Unable to save selected provider before sending.'; END IF;
 END IF;
 RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.charis_direct_create_provider_075(
 uuid,uuid,text,text,text,text,text,text,text,uuid[],uuid,jsonb,timestamptz,text
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_direct_create_provider_075(
 uuid,uuid,text,text,text,text,text,text,text,uuid[],uuid,jsonb,timestamptz,text
) TO authenticated;

COMMIT;
