-- CHARIS 082: up to 500 recipients per notification, sequenced in batches of 50.
-- Apply after CHARIS migrations 047, 055, 060, 075 and 081, NOT in Business OS.
-- Installing this SQL does not send any emails.
BEGIN;
ALTER TABLE public.charis_direct_settings
 ADD COLUMN IF NOT EXISTS daily_recipient_limit integer NOT NULL DEFAULT 500;
ALTER TABLE public.charis_direct_settings
 DROP CONSTRAINT IF EXISTS charis_direct_settings_max_recipients_check;
ALTER TABLE public.charis_direct_settings
 ADD CONSTRAINT charis_direct_settings_max_recipients_check CHECK(max_recipients BETWEEN 1 AND 500);
ALTER TABLE public.charis_direct_settings
 ADD CONSTRAINT charis_direct_settings_daily_recipient_limit_check CHECK(daily_recipient_limit BETWEEN 500 AND 10000);
ALTER TABLE public.charis_direct_messages
 DROP CONSTRAINT IF EXISTS charis_direct_messages_recipient_count_check;
ALTER TABLE public.charis_direct_messages
 ADD CONSTRAINT charis_direct_messages_recipient_count_check CHECK(recipient_count BETWEEN 1 AND 500);
ALTER TABLE public.charis_direct_recipients ADD COLUMN IF NOT EXISTS delivery_batch smallint;
ALTER TABLE public.charis_direct_recipients ADD CONSTRAINT charis_direct_delivery_batch_082
 CHECK(delivery_batch IS NULL OR delivery_batch BETWEEN 1 AND 10);
CREATE INDEX IF NOT EXISTS charis_direct_batch_pending_082 ON public.charis_direct_recipients(message_id,delivery_batch,created_at)
 WHERE status IN('pending','sending');

CREATE OR REPLACE FUNCTION public.charis_direct_settings_save(p_org uuid,p_approval boolean,p_email boolean,p_sms boolean,p_max integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.charis_direct_is_admin(p_org) THEN RAISE EXCEPTION 'Communication administrator access required';END IF;
 IF p_max NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Select 1–500 recipients per campaign';END IF;
 INSERT INTO public.charis_direct_settings(organization_id,approval_required,email_enabled,sms_enabled,max_recipients,updated_by)
 VALUES(p_org,p_approval,p_email,p_sms,p_max,auth.uid())
 ON CONFLICT(organization_id) DO UPDATE SET approval_required=excluded.approval_required,email_enabled=excluded.email_enabled,sms_enabled=excluded.sms_enabled,max_recipients=excluded.max_recipients,updated_by=excluded.updated_by,updated_at=now();
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'direct.settings_updated','communications',p_org::text,jsonb_build_object('approval_required',p_approval,'email_enabled',p_email,'sms_enabled',p_sms,'max_recipients',p_max));
END;$$;

CREATE OR REPLACE FUNCTION public.charis_direct_create(
 p_org uuid,p_key uuid,p_title text,p_subject text,p_body text,p_purpose text,p_product text,
 p_channel text,p_audience text,p_contact_ids uuid[],p_list uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;v_user uuid:=auth.uid();v_max integer;v_daily integer;v_approve boolean;v_email boolean;v_sms boolean;v_count integer;v_duplicates integer;
BEGIN
 IF NOT public.charis_direct_can_send(p_org) THEN RAISE EXCEPTION 'Your staff account cannot send customer communications';END IF;
 SELECT approval_required,email_enabled,sms_enabled,max_recipients,daily_recipient_limit INTO v_approve,v_email,v_sms,v_max,v_daily
 FROM public.charis_direct_settings WHERE organization_id=p_org;
 IF NOT FOUND THEN RAISE EXCEPTION 'Run communication migration 047 first';END IF;
 SELECT id INTO v_id FROM public.charis_direct_messages WHERE organization_id=p_org AND idempotency_key=p_key;
 IF FOUND THEN RETURN v_id;END IF;
 IF p_channel NOT IN ('email','sms') OR (p_channel='email' AND NOT v_email) OR (p_channel='sms' AND NOT v_sms)
 THEN RAISE EXCEPTION 'This communication channel is unavailable';END IF;
 IF p_purpose NOT IN ('service_notice','account_update','general_notice') THEN RAISE EXCEPTION 'Use the separate opted-in Marketing workflow for promotions';END IF;
 IF p_product NOT IN ('general','savings','current','fixed_deposit','loans','mobile_app','other') THEN RAISE EXCEPTION 'Invalid product';END IF;
 IF p_audience NOT IN ('selected','list','all') OR length(btrim(coalesce(p_title,''))) NOT BETWEEN 2 AND 120 OR
 length(btrim(coalesce(p_subject,''))) NOT BETWEEN 3 AND 180 OR length(btrim(coalesce(p_body,''))) NOT BETWEEN 10 AND 2000
 THEN RAISE EXCEPTION 'Complete the message and recipients';END IF;
 IF p_channel='sms' AND length(p_body)>480 THEN RAISE EXCEPTION 'SMS must be 480 characters or fewer';END IF;
 IF p_audience='selected' AND (coalesce(cardinality(p_contact_ids),0) NOT BETWEEN 1 AND v_max OR
  (SELECT count(DISTINCT u) FROM unnest(p_contact_ids) u) <> cardinality(p_contact_ids)) THEN RAISE EXCEPTION 'Select unique authorised customers';END IF;
 IF p_audience IN ('all','list') AND NOT public.charis_is_bankwide(p_org) THEN RAISE EXCEPTION 'Only bank-wide staff can send to lists or all customers';END IF;
 IF p_audience='list' AND (p_list IS NULL OR NOT EXISTS(SELECT 1 FROM public.contact_lists WHERE organization_id=p_org AND id=p_list)) THEN RAISE EXCEPTION 'Choose a valid saved group';END IF;
 -- Staff may send only to customers they are authorised to view; missing addresses invalidate the operation.
 WITH chosen AS (
 SELECT c.id,c.email,c.phone FROM public.contacts c
 WHERE c.organization_id=p_org AND c.archived_at IS NULL AND public.charis_can_view_customer(p_org,c.id)
 AND ((p_audience='selected' AND c.id=ANY(p_contact_ids)) OR
      (p_audience='list' AND EXISTS(SELECT 1 FROM public.contact_list_members l WHERE l.organization_id=p_org AND l.list_id=p_list AND l.contact_id=c.id)) OR
      p_audience='all')
 )
 SELECT count(*),count(DISTINCT CASE WHEN p_channel='email' THEN lower(email) ELSE regexp_replace(coalesce(phone,''),'[^0-9]','','g') END)
 INTO v_count,v_duplicates FROM chosen WHERE
 CASE WHEN p_channel='email' THEN email IS NOT NULL AND email ~ '^[^@ ]+@[^@ ]+[.][^@ ]+$'
 ELSE phone IS NOT NULL AND regexp_replace(phone,'[^0-9]','','g') ~ '^(234|0)[789][0-9]{9}$' END
 AND (p_channel<>'email' OR NOT EXISTS(SELECT 1 FROM public.email_suppressions x WHERE x.organization_id=p_org AND lower(x.email)=lower(chosen.email)));
 IF v_count NOT BETWEEN 1 AND v_max OR v_duplicates<>v_count THEN RAISE EXCEPTION 'Recipients exceed limit, include duplicate addresses, or lack usable contact details';END IF;
 IF p_audience='selected' AND v_count<>cardinality(p_contact_ids) THEN RAISE EXCEPTION 'Some selected customers are unavailable or suppressed';END IF;
 -- Serialize daily quota reservations across concurrent submissions.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_org::text||':direct_daily_082',0));
 IF (SELECT coalesce(sum(recipient_count),0) FROM public.charis_direct_messages
  WHERE organization_id=p_org AND created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')+v_count > v_daily
 THEN RAISE EXCEPTION 'Bank daily direct-communication limit (500) reached; contact an administrator';END IF;
 -- Suppress accidental repeated messages by the same staff member in the last 30s.
 PERFORM 1 FROM public.charis_direct_messages m WHERE m.organization_id=p_org AND m.created_by=v_user
 AND m.channel=p_channel AND m.subject=btrim(p_subject) AND m.body=btrim(p_body)
 AND m.created_at>now()-interval '30 seconds' LIMIT 1;
 IF FOUND THEN RAISE EXCEPTION 'This message was recently submitted. Check delivery history before sending again';END IF;
 INSERT INTO public.charis_direct_messages(organization_id,idempotency_key,title,subject,body,channel,purpose,product,audience_type,status,recipient_count,created_by)
 VALUES(p_org,p_key,btrim(p_title),btrim(p_subject),btrim(p_body),p_channel,p_purpose,p_product,p_audience,
 CASE WHEN v_approve THEN 'pending_approval' ELSE 'queued' END,v_count,v_user)
 ON CONFLICT(organization_id,idempotency_key) DO NOTHING RETURNING id INTO v_id;
 IF v_id IS NULL THEN SELECT id INTO v_id FROM public.charis_direct_messages WHERE organization_id=p_org AND idempotency_key=p_key;RETURN v_id;END IF;
 INSERT INTO public.charis_direct_recipients(organization_id,message_id,contact_id,recipient_email,recipient_phone)
 SELECT p_org,v_id,c.id,c.email,c.phone FROM public.contacts c
 WHERE c.organization_id=p_org AND c.archived_at IS NULL AND public.charis_can_view_customer(p_org,c.id)
 AND ((p_audience='selected' AND c.id=ANY(p_contact_ids)) OR
      (p_audience='list' AND EXISTS(SELECT 1 FROM public.contact_list_members l WHERE l.organization_id=p_org AND l.list_id=p_list AND l.contact_id=c.id)) OR
      p_audience='all')
 AND CASE WHEN p_channel='email' THEN c.email IS NOT NULL AND c.email ~ '^[^@ ]+@[^@ ]+[.][^@ ]+$'
 ELSE c.phone IS NOT NULL AND regexp_replace(c.phone,'[^0-9]','','g') ~ '^(234|0)[789][0-9]{9}$' END
 AND (p_channel<>'email' OR NOT EXISTS(SELECT 1 FROM public.email_suppressions x WHERE x.organization_id=p_org AND lower(x.email)=lower(c.email)));
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,v_user,'direct.message_created','direct_message',v_id::text,jsonb_build_object('channel',p_channel,'purpose',p_purpose,'recipients',v_count,'approval_required',v_approve));
 RETURN v_id;
END;$$;

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
 -- Group 50 at a time in the same transaction as campaign reservation.
 WITH numbered AS (
  SELECT r.id,1+((row_number() OVER(ORDER BY r.created_at,r.id)-1)::integer/50) AS phase
  FROM public.charis_direct_recipients r
  WHERE r.organization_id=p_org AND r.message_id=v_id
 )
 UPDATE public.charis_direct_recipients r SET delivery_batch=n.phase
 FROM numbered n WHERE r.id=n.id AND r.delivery_batch IS DISTINCT FROM n.phase;
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

CREATE OR REPLACE FUNCTION public.charis_direct_claim(p_org uuid DEFAULT NULL,p_message uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;v_org uuid;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Server worker only';END IF;
 SELECT r.id,r.organization_id INTO v_id,v_org FROM public.charis_direct_recipients r
 JOIN public.charis_direct_messages m ON m.id=r.message_id AND m.organization_id=r.organization_id
 WHERE r.status='pending' AND m.status IN ('queued','sending')
 AND (m.scheduled_at IS NULL OR m.scheduled_at<=now())
 -- Wait for the preceding 50-recipient groups to finish before starting the next group.
 AND NOT EXISTS (
  SELECT 1 FROM public.charis_direct_recipients prior
  WHERE prior.organization_id=r.organization_id AND prior.message_id=r.message_id
   AND r.delivery_batch IS NOT NULL AND prior.delivery_batch IS NOT NULL
   AND prior.delivery_batch<r.delivery_batch
   AND prior.status IN ('pending','sending')
 )
 AND (p_org IS NULL OR m.organization_id=p_org) AND (p_message IS NULL OR m.id=p_message)
 ORDER BY r.created_at,r.id FOR UPDATE OF r SKIP LOCKED LIMIT 1;
 IF v_id IS NULL THEN RETURN NULL;END IF;
 UPDATE public.charis_direct_recipients SET status='sending',updated_at=now() WHERE id=v_id;
 UPDATE public.charis_direct_messages SET status='sending',updated_at=now()
 WHERE id=(SELECT message_id FROM public.charis_direct_recipients WHERE id=v_id) AND status='queued';
 RETURN v_id;
END;$$;

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
  p_list IS NOT NULL OR coalesce(array_length(p_contact_ids,1),0) NOT BETWEEN 1 AND 500 OR
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

CREATE OR REPLACE FUNCTION public.charis_direct_settings_save_082(
 p_org uuid,p_approval boolean,p_email boolean,p_sms boolean,p_max integer,p_daily integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.charis_direct_is_admin(p_org)
 THEN RAISE EXCEPTION 'Charis administrator required';END IF;
 IF p_max NOT BETWEEN 1 AND 500 OR p_daily NOT BETWEEN 500 AND 10000 OR p_daily<p_max
 THEN RAISE EXCEPTION 'Choose up to 500 recipients per campaign; daily 500–10000'; END IF;
 PERFORM public.charis_direct_settings_save(p_org,p_approval,p_email,p_sms,p_max);
 UPDATE public.charis_direct_settings SET daily_recipient_limit=p_daily,updated_at=now(),updated_by=auth.uid()
 WHERE organization_id=p_org;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'direct.daily_quota_updated','communications',p_org::text,jsonb_build_object('daily_limit',p_daily));
END;$$;
REVOKE ALL ON FUNCTION public.charis_direct_settings_save_082(uuid,boolean,boolean,boolean,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.charis_direct_settings_save_082(uuid,boolean,boolean,boolean,integer,integer) TO authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';
