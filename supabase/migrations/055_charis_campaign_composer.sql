-- 055: Unified Charis Create Campaign composer. Requires SQL 047–051.
-- Additive: old campaigns, recipients, provider settings and audit history remain unchanged.
-- This migration alone never sends messages.
BEGIN;
ALTER TABLE public.charis_direct_messages
 ADD COLUMN IF NOT EXISTS design jsonb,
 ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
CREATE INDEX IF NOT EXISTS charis_direct_scheduled
 ON public.charis_direct_messages (scheduled_at, organization_id)
 WHERE scheduled_at IS NOT NULL AND status IN ('queued','sending');

-- Wrap the existing security-checked recipient snapshot function in the same transaction.
-- No eligible recipient can be claimed before design and schedule are committed.
CREATE OR REPLACE FUNCTION public.charis_direct_create_v2(
 p_org uuid,p_key uuid,p_title text,p_subject text,p_body text,p_purpose text,
 p_product text,p_channel text,p_audience text,p_contact_ids uuid[],p_list uuid,
 p_design jsonb DEFAULT NULL,p_scheduled_at timestamptz DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;v_owner uuid;v_status text;
BEGIN
 IF p_scheduled_at IS NOT NULL AND (
   p_scheduled_at < now()+interval '5 minutes' OR
   p_scheduled_at > now()+interval '30 days') THEN
  RAISE EXCEPTION 'Choose a sending time between 5 minutes and 30 days from now';
 END IF;
 IF p_design IS NOT NULL AND (
   p_channel <> 'email' OR jsonb_typeof(p_design) <> 'object' OR
   p_design->>'version'<>'1' OR jsonb_typeof(p_design->'blocks') <> 'array' OR
   length(p_design::text)>30000 OR jsonb_array_length(p_design->'blocks') NOT BETWEEN 1 AND 30
 ) THEN RAISE EXCEPTION 'Invalid email design'; END IF;
 -- Never alter a previous submission if the browser repeats the same idempotency key.
 SELECT id,created_by INTO v_id,v_owner FROM public.charis_direct_messages
 WHERE organization_id=p_org AND idempotency_key=p_key;
 IF FOUND THEN
  IF v_owner IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Campaign unavailable'; END IF;
  RETURN v_id;
 END IF;
 v_id:=public.charis_direct_create(
  p_org,p_key,p_title,p_subject,p_body,p_purpose,p_product,
  p_channel,p_audience,p_contact_ids,p_list);
 UPDATE public.charis_direct_messages
 SET design=p_design,scheduled_at=p_scheduled_at,updated_at=now()
 WHERE id=v_id AND organization_id=p_org AND created_by=auth.uid()
   AND status IN ('queued','pending_approval');
 IF NOT FOUND THEN RAISE EXCEPTION 'Campaign creation could not be finalised'; END IF;
 IF p_scheduled_at IS NOT NULL THEN
  INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
  VALUES (p_org,auth.uid(),'direct.campaign_scheduled','direct_message',v_id::text,
          jsonb_build_object('scheduled_at',p_scheduled_at));
 END IF;
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.charis_direct_create_v2(uuid,uuid,text,text,text,text,text,text,text,uuid[],uuid,jsonb,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_direct_create_v2(uuid,uuid,text,text,text,text,text,text,text,uuid[],uuid,jsonb,timestamptz) TO authenticated;

-- An approved scheduled campaign stays queued, but isn't claimable before its due time.
CREATE OR REPLACE FUNCTION public.charis_direct_claim(p_org uuid DEFAULT NULL,p_message uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;v_org uuid;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Server worker only';END IF;
 SELECT r.id,r.organization_id INTO v_id,v_org FROM public.charis_direct_recipients r
 JOIN public.charis_direct_messages m ON m.id=r.message_id AND m.organization_id=r.organization_id
 WHERE r.status='pending' AND m.status IN ('queued','sending')
 AND (m.scheduled_at IS NULL OR m.scheduled_at<=now())
 AND (p_org IS NULL OR m.organization_id=p_org) AND (p_message IS NULL OR m.id=p_message)
 ORDER BY r.created_at,r.id FOR UPDATE OF r SKIP LOCKED LIMIT 1;
 IF v_id IS NULL THEN RETURN NULL;END IF;
 UPDATE public.charis_direct_recipients SET status='sending',updated_at=now() WHERE id=v_id;
 UPDATE public.charis_direct_messages SET status='sending',updated_at=now()
 WHERE id=(SELECT message_id FROM public.charis_direct_recipients WHERE id=v_id) AND status='queued';
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.charis_direct_claim(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.charis_direct_claim(uuid,uuid) TO service_role;

-- Cancel only future, completely unsent scheduled messages.
CREATE OR REPLACE FUNCTION public.charis_direct_cancel_scheduled(p_org uuid,p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_creator uuid;v_status text;v_time timestamptz;
BEGIN
 SELECT created_by,status,scheduled_at INTO v_creator,v_status,v_time
 FROM public.charis_direct_messages
 WHERE organization_id=p_org AND id=p_id FOR UPDATE;
 IF NOT FOUND OR (v_creator IS DISTINCT FROM auth.uid() AND NOT public.charis_direct_is_admin(p_org))
 THEN RAISE EXCEPTION 'Campaign unavailable'; END IF;
 IF v_time IS NULL OR v_time<=now() OR v_status NOT IN ('queued','pending_approval')
 OR EXISTS (SELECT 1 FROM public.charis_direct_recipients
            WHERE organization_id=p_org AND message_id=p_id AND status<>'pending')
 THEN RAISE EXCEPTION 'Only a future campaign with no delivery attempts can be cancelled'; END IF;
 UPDATE public.charis_direct_messages SET status='cancelled',updated_at=now()
 WHERE organization_id=p_org AND id=p_id;
 UPDATE public.charis_direct_recipients
 SET status='skipped',error_code='scheduled_cancelled',updated_at=now()
 WHERE organization_id=p_org AND message_id=p_id AND status='pending';
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id)
 VALUES (p_org,auth.uid(),'direct.campaign_cancelled','direct_message',p_id::text);
END;$$;
REVOKE ALL ON FUNCTION public.charis_direct_cancel_scheduled(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_direct_cancel_scheduled(uuid,uuid) TO authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';
