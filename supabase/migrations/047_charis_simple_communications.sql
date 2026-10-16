-- 047: Charis direct service communications. Additive. Does NOT alter legacy campaigns.
-- Install once AFTER 045; no email or SMS is sent by SQL.
BEGIN;
INSERT INTO public.charis_permission_catalog(permission_key,label,category,description) VALUES
 ('communications.send','Send customer communications','Communications','Send authorised bank notices to customers within assigned branch access')
 ON CONFLICT(permission_key) DO NOTHING;
CREATE TABLE IF NOT EXISTS public.charis_direct_settings (
 organization_id uuid PRIMARY KEY REFERENCES public.organizations(id),
 approval_required boolean NOT NULL DEFAULT false,
 email_enabled boolean NOT NULL DEFAULT true,
 sms_enabled boolean NOT NULL DEFAULT false,
 max_recipients integer NOT NULL DEFAULT 20 CHECK(max_recipients BETWEEN 1 AND 50),
 updated_by uuid REFERENCES auth.users(id),updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.charis_direct_settings(organization_id)
 SELECT id FROM public.organizations WHERE slug='charis-mfb'
 ON CONFLICT(organization_id) DO NOTHING;
CREATE TABLE IF NOT EXISTS public.charis_direct_staff_rules (
 organization_id uuid NOT NULL,
 user_id uuid NOT NULL,
 can_send boolean NOT NULL DEFAULT true,
 updated_by uuid REFERENCES auth.users(id),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,user_id),
 FOREIGN KEY(organization_id,user_id) REFERENCES public.organization_members(organization_id,user_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.charis_direct_provider_prefs (
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 provider text NOT NULL CHECK(provider IN ('resend','brevo','mailjet')),
 sender_id uuid NOT NULL,
 enabled boolean NOT NULL DEFAULT false,
 priority smallint NOT NULL DEFAULT 10 CHECK(priority BETWEEN 1 AND 100),
 updated_by uuid REFERENCES auth.users(id),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,provider),
 FOREIGN KEY(organization_id,sender_id) REFERENCES public.sender_identities(organization_id,id)
);
CREATE TABLE IF NOT EXISTS public.charis_direct_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 idempotency_key uuid NOT NULL,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 2 AND 120),
 subject text NOT NULL CHECK(length(btrim(subject)) BETWEEN 3 AND 180),
 body text NOT NULL CHECK(length(btrim(body)) BETWEEN 10 AND 2000),
 channel text NOT NULL CHECK(channel IN ('email','sms')),
 purpose text NOT NULL CHECK(purpose IN ('service_notice','account_update','general_notice')),
 product text NOT NULL DEFAULT 'general' CHECK(length(product) BETWEEN 1 AND 40),
 audience_type text NOT NULL CHECK(audience_type IN ('selected','list','all')),
 status text NOT NULL CHECK(status IN ('queued','pending_approval','sending','completed','paused','cancelled')),
 recipient_count integer NOT NULL CHECK(recipient_count BETWEEN 1 AND 50),
 created_by uuid NOT NULL REFERENCES auth.users(id),approved_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id),UNIQUE(organization_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS charis_direct_recent ON public.charis_direct_messages(organization_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.charis_direct_recipients (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL, message_id uuid NOT NULL,contact_id uuid NOT NULL,
 recipient_email text,recipient_phone text,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','accepted','failed','unknown','skipped')),
 provider text,provider_message_id text,error_code text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(message_id,contact_id),
 FOREIGN KEY(organization_id,message_id) REFERENCES public.charis_direct_messages(organization_id,id),
 FOREIGN KEY(organization_id,contact_id) REFERENCES public.contacts(organization_id,id)
);
CREATE INDEX IF NOT EXISTS charis_direct_pending ON public.charis_direct_recipients(organization_id,created_at) WHERE status='pending';

ALTER TABLE public.charis_direct_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charis_direct_staff_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charis_direct_provider_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charis_direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charis_direct_recipients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charis_direct_settings,public.charis_direct_staff_rules,public.charis_direct_provider_prefs,public.charis_direct_messages,public.charis_direct_recipients FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.charis_direct_settings,public.charis_direct_staff_rules,public.charis_direct_provider_prefs,public.charis_direct_messages,public.charis_direct_recipients TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_direct_is_admin(p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.is_platform_super_admin() OR public.charis_has_permission(p_org,'settings.manage');
$$;
REVOKE ALL ON FUNCTION public.charis_direct_is_admin(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_direct_is_admin(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_direct_can_send(p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.organizations o WHERE o.id=p_org AND o.slug='charis-mfb' AND o.status='active')
 AND (public.is_platform_super_admin() OR EXISTS(
   SELECT 1 FROM public.organization_members m WHERE m.organization_id=p_org AND m.user_id=(SELECT auth.uid())
 )) AND NOT EXISTS(SELECT 1 FROM public.charis_direct_staff_rules r
 WHERE r.organization_id=p_org AND r.user_id=(SELECT auth.uid()) AND NOT r.can_send)
 AND NOT EXISTS(SELECT 1 FROM public.charis_staff_permissions p
 WHERE p.organization_id=p_org AND p.user_id=(SELECT auth.uid()) AND p.permission_key='communications.send' AND NOT p.allowed);
$$;
REVOKE ALL ON FUNCTION public.charis_direct_can_send(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_direct_can_send(uuid) TO authenticated;

DROP POLICY IF EXISTS charis_direct_settings_read ON public.charis_direct_settings;
CREATE POLICY charis_direct_settings_read ON public.charis_direct_settings FOR SELECT TO authenticated
 USING(public.charis_direct_can_send(organization_id) OR public.charis_direct_is_admin(organization_id));
DROP POLICY IF EXISTS charis_direct_staff_rules_read ON public.charis_direct_staff_rules;
CREATE POLICY charis_direct_staff_rules_read ON public.charis_direct_staff_rules FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()) OR public.charis_direct_is_admin(organization_id));
DROP POLICY IF EXISTS charis_direct_prefs_read ON public.charis_direct_provider_prefs;
CREATE POLICY charis_direct_prefs_read ON public.charis_direct_provider_prefs FOR SELECT TO authenticated USING(public.charis_direct_is_admin(organization_id));
DROP POLICY IF EXISTS charis_direct_messages_read ON public.charis_direct_messages;
CREATE POLICY charis_direct_messages_read ON public.charis_direct_messages FOR SELECT TO authenticated
 USING((created_by=(SELECT auth.uid()) AND public.charis_direct_can_send(organization_id)) OR public.charis_direct_is_admin(organization_id));
DROP POLICY IF EXISTS charis_direct_recipients_read ON public.charis_direct_recipients;
CREATE POLICY charis_direct_recipients_read ON public.charis_direct_recipients FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.charis_direct_messages m WHERE m.organization_id=charis_direct_recipients.organization_id
 AND m.id=charis_direct_recipients.message_id AND (m.created_by=(SELECT auth.uid()) OR public.charis_direct_is_admin(m.organization_id))));

CREATE OR REPLACE FUNCTION public.charis_direct_settings_save(p_org uuid,p_approval boolean,p_email boolean,p_sms boolean,p_max integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.charis_direct_is_admin(p_org) THEN RAISE EXCEPTION 'Communication administrator access required';END IF;
 IF p_max NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Select 1–50 recipients per message';END IF;
 INSERT INTO public.charis_direct_settings(organization_id,approval_required,email_enabled,sms_enabled,max_recipients,updated_by)
 VALUES(p_org,p_approval,p_email,p_sms,p_max,auth.uid())
 ON CONFLICT(organization_id) DO UPDATE SET approval_required=excluded.approval_required,email_enabled=excluded.email_enabled,sms_enabled=excluded.sms_enabled,max_recipients=excluded.max_recipients,updated_by=excluded.updated_by,updated_at=now();
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'direct.settings_updated','communications',p_org::text,jsonb_build_object('approval_required',p_approval,'email_enabled',p_email,'sms_enabled',p_sms,'max_recipients',p_max));
END;$$;
REVOKE ALL ON FUNCTION public.charis_direct_settings_save(uuid,boolean,boolean,boolean,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_direct_settings_save(uuid,boolean,boolean,boolean,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_direct_staff_rule_save(p_org uuid,p_user uuid,p_can_send boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.charis_direct_is_admin(p_org) THEN RAISE EXCEPTION 'Communication administrator access required';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id=p_org AND user_id=p_user) THEN RAISE EXCEPTION 'Staff member unavailable';END IF;
 IF NOT p_can_send AND p_user=auth.uid() THEN RAISE EXCEPTION 'Cannot disable your own sending access';END IF;
 INSERT INTO public.charis_direct_staff_rules(organization_id,user_id,can_send,updated_by)
 VALUES(p_org,p_user,p_can_send,auth.uid()) ON CONFLICT(organization_id,user_id)
 DO UPDATE SET can_send=excluded.can_send,updated_by=excluded.updated_by,updated_at=now();
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'direct.staff_access_changed','staff',p_user::text,jsonb_build_object('can_send',p_can_send));
END;$$;
REVOKE ALL ON FUNCTION public.charis_direct_staff_rule_save(uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_direct_staff_rule_save(uuid,uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_direct_provider_save(p_org uuid,p_provider text,p_sender uuid,p_enabled boolean,p_priority integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.charis_direct_is_admin(p_org) THEN RAISE EXCEPTION 'Communication administrator access required';END IF;
 IF p_provider NOT IN ('resend','brevo','mailjet') OR p_priority NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid provider configuration';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sender_identities s
 JOIN public.sending_domains d ON d.id=s.domain_id AND d.organization_id=s.organization_id
 WHERE s.id=p_sender AND s.organization_id=p_org AND s.is_active AND d.provider=p_provider
 AND d.verification_status='verified' AND d.charis_connected)
 THEN RAISE EXCEPTION 'Select a verified, active sender for this provider';END IF;
 INSERT INTO public.charis_direct_provider_prefs(organization_id,provider,sender_id,enabled,priority,updated_by)
 VALUES(p_org,p_provider,p_sender,p_enabled,p_priority,auth.uid())
 ON CONFLICT(organization_id,provider) DO UPDATE SET sender_id=excluded.sender_id,enabled=excluded.enabled,priority=excluded.priority,updated_by=excluded.updated_by,updated_at=now();
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'direct.provider_configured','email_provider',p_provider,jsonb_build_object('enabled',p_enabled,'priority',p_priority));
END;$$;
REVOKE ALL ON FUNCTION public.charis_direct_provider_save(uuid,text,uuid,boolean,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_direct_provider_save(uuid,text,uuid,boolean,integer) TO authenticated;

-- Safely reserve recipient snapshots in ONE transaction before any provider request.
CREATE OR REPLACE FUNCTION public.charis_direct_create(
 p_org uuid,p_key uuid,p_title text,p_subject text,p_body text,p_purpose text,p_product text,
 p_channel text,p_audience text,p_contact_ids uuid[],p_list uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;v_user uuid:=auth.uid();v_max integer;v_approve boolean;v_email boolean;v_sms boolean;v_count integer;v_duplicates integer;
BEGIN
 IF NOT public.charis_direct_can_send(p_org) THEN RAISE EXCEPTION 'Your staff account cannot send customer communications';END IF;
 SELECT approval_required,email_enabled,sms_enabled,max_recipients INTO v_approve,v_email,v_sms,v_max
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
 IF (SELECT coalesce(sum(recipient_count),0) FROM public.charis_direct_messages
  WHERE organization_id=p_org AND created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')+v_count > 500
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
REVOKE ALL ON FUNCTION public.charis_direct_create(uuid,uuid,text,text,text,text,text,text,text,uuid[],uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_direct_create(uuid,uuid,text,text,text,text,text,text,text,uuid[],uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_direct_approve(p_org uuid,p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_creator uuid;
BEGIN
 IF NOT (public.charis_direct_is_admin(p_org) OR public.charis_has_permission(p_org,'campaigns.approve')) THEN RAISE EXCEPTION 'Approver access required';END IF;
 SELECT created_by INTO v_creator FROM public.charis_direct_messages WHERE organization_id=p_org AND id=p_id AND status='pending_approval' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Message is not pending approval';END IF;
 IF v_creator=auth.uid() AND NOT public.is_platform_super_admin() THEN RAISE EXCEPTION 'Another authorised staff member must approve';END IF;
 UPDATE public.charis_direct_messages SET status='queued',approved_by=auth.uid(),updated_at=now() WHERE organization_id=p_org AND id=p_id;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id)
 VALUES(p_org,auth.uid(),'direct.message_approved','direct_message',p_id::text);
END;$$;
REVOKE ALL ON FUNCTION public.charis_direct_approve(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_direct_approve(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_direct_claim(p_org uuid DEFAULT NULL,p_message uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;v_org uuid;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Server worker only';END IF;
 SELECT r.id,r.organization_id INTO v_id,v_org FROM public.charis_direct_recipients r
 JOIN public.charis_direct_messages m ON m.id=r.message_id AND m.organization_id=r.organization_id
 WHERE r.status='pending' AND m.status IN ('queued','sending')
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

CREATE OR REPLACE FUNCTION public.charis_direct_finish(p_id uuid,p_status text,p_provider text,p_provider_id text,p_error text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_msg uuid;v_org uuid;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Server worker only';END IF;
 IF p_status NOT IN ('accepted','failed','unknown','skipped') THEN RAISE EXCEPTION 'Invalid outcome';END IF;
 UPDATE public.charis_direct_recipients SET status=p_status,provider=left(p_provider,30),provider_message_id=left(p_provider_id,250),error_code=left(p_error,140),updated_at=now()
 WHERE id=p_id AND status='sending' RETURNING message_id,organization_id INTO v_msg,v_org;
 IF v_msg IS NULL THEN RAISE EXCEPTION 'Recipient is not actively claimed';END IF;
 IF p_status='unknown' THEN
  UPDATE public.charis_direct_messages SET status='paused',updated_at=now() WHERE id=v_msg;
 ELSIF NOT EXISTS(SELECT 1 FROM public.charis_direct_recipients WHERE message_id=v_msg AND status IN ('pending','sending')) THEN
  UPDATE public.charis_direct_messages SET status='completed',updated_at=now() WHERE id=v_msg AND status IN ('queued','sending');
 END IF;
END;$$;
REVOKE ALL ON FUNCTION public.charis_direct_finish(uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.charis_direct_finish(uuid,text,text,text,text) TO service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
