-- CHARIS 023: SMS pilot. Safe to apply ONCE after 022.
-- No bulk SMS dispatch in this phase. Independent review and controlled staff test only.
BEGIN;
CREATE TABLE IF NOT EXISTS public.charis_sms_campaigns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 2 AND 120),
 message text NOT NULL CHECK(length(btrim(message)) BETWEEN 1 AND 480),
 purpose text NOT NULL CHECK(purpose IN ('marketing','service_notice')),
 audience_type text NOT NULL CHECK(audience_type IN ('all','list')),
 audience_id uuid,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending_approval','approved','rejected')),
 revision integer NOT NULL DEFAULT 1,
 edited_by uuid NOT NULL REFERENCES auth.users(id),
 submitted_by uuid REFERENCES auth.users(id),
 reviewed_by uuid REFERENCES auth.users(id),
 review_note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id),
 CHECK((audience_type='all' AND audience_id IS NULL) OR (audience_type='list' AND audience_id IS NOT NULL)),
 FOREIGN KEY (organization_id,audience_id) REFERENCES public.contact_lists(organization_id,id)
);
CREATE INDEX IF NOT EXISTS charis_sms_campaign_org_idx ON public.charis_sms_campaigns(organization_id,updated_at DESC);
ALTER TABLE public.charis_sms_campaigns ENABLE ROW LEVEL SECURITY;
REVOKE INSERT,UPDATE,DELETE ON public.charis_sms_campaigns FROM authenticated,anon;
GRANT SELECT ON public.charis_sms_campaigns TO authenticated;
CREATE POLICY "sms campaigns members read" ON public.charis_sms_campaigns FOR SELECT TO authenticated USING (public.is_organization_member(organization_id) OR public.is_platform_super_admin());

-- Reserve tests in the DB BEFORE calling the SMS provider. A separate per-user limit protects the bank wallet.
CREATE TABLE IF NOT EXISTS public.charis_sms_tests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL,
 campaign_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','accepted','failed','unknown')),
 provider_message_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 FOREIGN KEY (organization_id,campaign_id) REFERENCES public.charis_sms_campaigns(organization_id,id)
);
CREATE INDEX IF NOT EXISTS charis_sms_tests_limit_idx ON public.charis_sms_tests(organization_id,actor_id,created_at DESC);
ALTER TABLE public.charis_sms_tests ENABLE ROW LEVEL SECURITY;
REVOKE INSERT,UPDATE,DELETE ON public.charis_sms_tests FROM authenticated,anon;
GRANT SELECT ON public.charis_sms_tests TO authenticated;
CREATE POLICY "sms test history members read" ON public.charis_sms_tests FOR SELECT TO authenticated USING (public.is_organization_member(organization_id) OR public.is_platform_super_admin());

CREATE OR REPLACE FUNCTION public.charis_sms_save(p_org uuid,p_id uuid,p_title text,p_message text,p_purpose text,p_audience_type text,p_audience uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_campaign public.charis_sms_campaigns;
BEGIN
 IF NOT public.can_edit_campaigns(p_org) THEN RAISE EXCEPTION 'Campaign editing permission required'; END IF;
 IF length(btrim(coalesce(p_title,''))) NOT BETWEEN 2 AND 120 OR length(btrim(coalesce(p_message,''))) NOT BETWEEN 1 AND 480 THEN RAISE EXCEPTION 'Enter a campaign title and SMS message (maximum 480 characters)'; END IF;
 IF p_purpose NOT IN ('marketing','service_notice') THEN RAISE EXCEPTION 'Choose a valid communication purpose'; END IF;
 IF p_audience_type NOT IN ('all','list') OR (p_audience_type='all' AND p_audience IS NOT NULL) OR (p_audience_type='list' AND p_audience IS NULL) THEN RAISE EXCEPTION 'Choose a valid audience'; END IF;
 IF p_audience_type='list' AND NOT EXISTS(SELECT 1 FROM public.contact_lists WHERE id=p_audience AND organization_id=p_org) THEN RAISE EXCEPTION 'Customer group not found'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.charis_sms_campaigns(organization_id,title,message,purpose,audience_type,audience_id,edited_by)
  VALUES(p_org,btrim(p_title),btrim(p_message),p_purpose,p_audience_type,p_audience,auth.uid()) RETURNING id INTO v_id;
 ELSE
  SELECT * INTO v_campaign FROM public.charis_sms_campaigns WHERE organization_id=p_org AND id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SMS draft not found'; END IF;
  IF v_campaign.status NOT IN ('draft','rejected') THEN RAISE EXCEPTION 'Withdraw this submission before editing'; END IF;
  UPDATE public.charis_sms_campaigns SET title=btrim(p_title),message=btrim(p_message),purpose=p_purpose,audience_type=p_audience_type,audience_id=p_audience,
   status='draft',revision=revision+1,edited_by=auth.uid(),submitted_by=NULL,reviewed_by=NULL,review_note='',updated_at=now()
  WHERE id=p_id RETURNING id INTO v_id;
 END IF;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id) VALUES (p_org,auth.uid(),'sms.draft_saved','sms_campaign',v_id::text);
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.charis_sms_save(uuid,uuid,text,text,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_sms_save(uuid,uuid,text,text,text,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_sms_transition(p_org uuid,p_id uuid,p_action text,p_note text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.charis_sms_campaigns;
BEGIN
 SELECT * INTO r FROM public.charis_sms_campaigns WHERE id=p_id AND organization_id=p_org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SMS campaign unavailable'; END IF;
 IF p_action='submit' THEN
  IF NOT public.can_edit_campaigns(p_org) OR r.status NOT IN ('draft','rejected') THEN RAISE EXCEPTION 'Cannot submit this SMS campaign'; END IF;
  UPDATE public.charis_sms_campaigns SET status='pending_approval',submitted_by=auth.uid(),updated_at=now() WHERE id=p_id;
 ELSIF p_action IN ('approve','reject') THEN
  IF NOT public.can_approve_campaigns(p_org) OR r.status<>'pending_approval' OR auth.uid() IN (r.edited_by,r.submitted_by) THEN RAISE EXCEPTION 'Independent SMS review required'; END IF;
  IF length(coalesce(p_note,''))>600 THEN RAISE EXCEPTION 'Review note too long'; END IF;
  UPDATE public.charis_sms_campaigns SET status=CASE WHEN p_action='approve' THEN 'approved' ELSE 'rejected' END,reviewed_by=auth.uid(),review_note=coalesce(p_note,''),updated_at=now() WHERE id=p_id;
 ELSIF p_action='withdraw' THEN
  IF NOT public.can_edit_campaigns(p_org) OR r.status<>'pending_approval' THEN RAISE EXCEPTION 'Only a submitted SMS campaign can be withdrawn'; END IF;
  UPDATE public.charis_sms_campaigns SET status='draft',submitted_by=NULL,updated_at=now() WHERE id=p_id;
 ELSE RAISE EXCEPTION 'Unsupported action'; END IF;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'sms.'||p_action,'sms_campaign',p_id::text,jsonb_build_object('purpose',r.purpose,'previous_status',r.status));
END;$$;
REVOKE ALL ON FUNCTION public.charis_sms_transition(uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_sms_transition(uuid,uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_sms_test_reserve(p_org uuid,p_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT public.can_edit_campaigns(p_org) THEN RAISE EXCEPTION 'Campaign editing permission required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.charis_sms_campaigns WHERE id=p_id AND organization_id=p_org) THEN RAISE EXCEPTION 'Save the SMS campaign before testing'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(p_org::text||':'||auth.uid()::text||':sms-test'));
 IF EXISTS(SELECT 1 FROM public.charis_sms_tests WHERE organization_id=p_org AND actor_id=auth.uid() AND created_at>now()-interval '60 seconds') THEN RAISE EXCEPTION 'Wait one minute before sending another test'; END IF;
 IF (SELECT count(*) FROM public.charis_sms_tests WHERE organization_id=p_org AND actor_id=auth.uid() AND created_at>now()-interval '1 day')>=5 THEN RAISE EXCEPTION 'Daily SMS test limit reached'; END IF;
 INSERT INTO public.charis_sms_tests(organization_id,campaign_id,actor_id) VALUES (p_org,p_id,auth.uid()) RETURNING id INTO v_id;
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.charis_sms_test_reserve(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_sms_test_reserve(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_sms_test_finish(p_org uuid,p_attempt uuid,p_actor uuid,p_status text,p_provider_id text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_status NOT IN ('accepted','failed','unknown') THEN RAISE EXCEPTION 'Invalid test result'; END IF;
 UPDATE public.charis_sms_tests SET status=p_status,provider_message_id=left(p_provider_id,120),completed_at=now()
 WHERE id=p_attempt AND organization_id=p_org AND actor_id=p_actor AND status='reserved' AND created_at>now()-interval '10 minutes';
 IF NOT FOUND THEN RAISE EXCEPTION 'SMS test reservation unavailable'; END IF;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,p_actor,'sms.test.'||p_status,'sms_test',p_attempt::text,jsonb_build_object('provider_id',left(p_provider_id,120)));
END;$$;
REVOKE ALL ON FUNCTION public.charis_sms_test_finish(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.charis_sms_test_finish(uuid,uuid,uuid,text,text) TO service_role;
COMMIT;
