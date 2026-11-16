-- 089: Campaign copy recipients and retirement of the Zoho Campaigns UI.
-- CC/BCC are committed atomically with the campaign before a delivery worker can claim it.
-- Historical Zoho evidence tables remain inaccessible (revoked by 088) for audit retention.
BEGIN;

ALTER TABLE public.charis_direct_messages
  ADD COLUMN IF NOT EXISTS cc_emails text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS bcc_emails text[] NOT NULL DEFAULT '{}'::text[];

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='charis_direct_copy_recipients_089'
    AND conrelid='public.charis_direct_messages'::regclass) THEN
    ALTER TABLE public.charis_direct_messages
      ADD CONSTRAINT charis_direct_copy_recipients_089 CHECK (
        cardinality(cc_emails) <= 10 AND cardinality(bcc_emails) <= 10
        AND (channel='email' OR (cardinality(cc_emails)=0 AND cardinality(bcc_emails)=0))
        AND NOT (cc_emails && bcc_emails)
        AND NOT EXISTS (SELECT 1 FROM unnest(cc_emails || bcc_emails) AS e
          WHERE e IS NULL OR e<>lower(btrim(e))
          OR e !~* '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9.-]+\\.[a-z]{2,}$')
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.charis_direct_create_provider_089(
 p_org uuid,p_key uuid,p_title text,p_subject text,p_body text,p_purpose text,
 p_product text,p_channel text,p_audience text,p_contact_ids uuid[],p_list uuid,
 p_design jsonb,p_scheduled_at timestamptz,p_provider text,
 p_cc text[] DEFAULT '{}'::text[],p_bcc text[] DEFAULT '{}'::text[]
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;v_existing uuid;v_old_cc text[];v_old_bcc text[];
BEGIN
 p_cc:=coalesce(p_cc,'{}'::text[]);
 p_bcc:=coalesce(p_bcc,'{}'::text[]);
 IF cardinality(p_cc)>10 OR cardinality(p_bcc)>10
   OR (p_channel<>'email' AND (cardinality(p_cc)>0 OR cardinality(p_bcc)>0))
   OR p_cc && p_bcc
   OR EXISTS(SELECT 1 FROM unnest(p_cc||p_bcc) AS e
      WHERE e IS NULL OR e<>lower(btrim(e))
      OR e !~* '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9.-]+\\.[a-z]{2,}$')
 THEN RAISE EXCEPTION 'Review CC and BCC addresses. Use up to 10 unique, valid addresses in each field.'; END IF;

 SELECT id,cc_emails,bcc_emails INTO v_existing,v_old_cc,v_old_bcc
 FROM public.charis_direct_messages
 WHERE organization_id=p_org AND idempotency_key=p_key;
 IF FOUND AND (coalesce(v_old_cc,'{}'::text[]) IS DISTINCT FROM p_cc
   OR coalesce(v_old_bcc,'{}'::text[]) IS DISTINCT FROM p_bcc) THEN
  RAISE EXCEPTION 'This campaign was already saved with different CC/BCC recipients. Start a new campaign to change them.';
 END IF;

 v_id:=public.charis_direct_create_provider_075(
  p_org,p_key,p_title,p_subject,p_body,p_purpose,p_product,p_channel,p_audience,
  p_contact_ids,p_list,p_design,p_scheduled_at,p_provider
 );
 IF v_existing IS NULL THEN
  UPDATE public.charis_direct_messages
  SET cc_emails=p_cc,bcc_emails=p_bcc
  WHERE id=v_id AND organization_id=p_org AND created_by=auth.uid()
    AND status IN ('queued','pending_approval');
  IF NOT FOUND THEN RAISE EXCEPTION 'Unable to save campaign copy recipients before delivery.'; END IF;
 END IF;
 RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.charis_direct_create_provider_089(
 uuid,uuid,text,text,text,text,text,text,text,uuid[],uuid,jsonb,timestamptz,text,text[],text[]
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_direct_create_provider_089(
 uuid,uuid,text,text,text,text,text,text,text,uuid[],uuid,jsonb,timestamptz,text,text[],text[]
) TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
