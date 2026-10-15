-- Charis 040: opt-in marketing only, Resend Broadcasts integration.
-- No email is sent by this migration. Apply after migration 039.
BEGIN;
CREATE TABLE IF NOT EXISTS public.charis_resend_broadcast_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 campaign_id uuid NOT NULL,
 run_id uuid NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing','building','ready','submitting','submitted','uncertain','failed')),
 segment_id text,
 broadcast_id text,
 recipient_count integer NOT NULL DEFAULT 0 CHECK (recipient_count BETWEEN 0 AND 50),
 initiated_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 last_error text,
 UNIQUE (organization_id,campaign_id),
 FOREIGN KEY (organization_id,campaign_id) REFERENCES public.campaign_drafts(organization_id,id),
 FOREIGN KEY (organization_id,run_id) REFERENCES public.campaign_runs(organization_id,id)
);
CREATE INDEX IF NOT EXISTS charis_resend_jobs_org_recent_idx ON public.charis_resend_broadcast_jobs(organization_id,created_at DESC);
ALTER TABLE public.charis_resend_broadcast_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charis_resend_broadcast_jobs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.charis_resend_broadcast_jobs TO authenticated;
DROP POLICY IF EXISTS charis_resend_jobs_view ON public.charis_resend_broadcast_jobs;
CREATE POLICY charis_resend_jobs_view ON public.charis_resend_broadcast_jobs FOR SELECT TO authenticated USING (
 public.charis_has_permission(organization_id,'campaigns.view')
);

-- Reserve an approved campaign with its existing vetted recipient snapshot. The
-- ordinary mail delivery worker MUST NOT process this run: it is paused in the
-- same transaction that creates it, before the snapshot becomes visible.
CREATE OR REPLACE FUNCTION public.charis_resend_broadcast_prepare(p_org uuid,p_campaign uuid,p_revision integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_run uuid;v_count integer;v_c public.campaign_drafts;v_provider text;v_route boolean;
BEGIN
 IF NOT public.charis_has_permission(p_org,'campaigns.send') OR NOT public.can_dispatch_campaigns(p_org) THEN
  RAISE EXCEPTION 'Authorised campaign dispatcher required';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=p_org AND slug='charis-mfb' AND status='active') THEN
  RAISE EXCEPTION 'Charis workspace unavailable';END IF;
 SELECT * INTO v_c FROM public.campaign_drafts WHERE id=p_campaign AND organization_id=p_org FOR UPDATE;
 IF NOT FOUND OR v_c.status <> 'approved' OR v_c.revision <> p_revision THEN
  RAISE EXCEPTION 'The campaign requires a current independent approval';END IF;
 SELECT d.provider INTO v_provider FROM public.sender_identities s
 JOIN public.sending_domains d ON d.id=s.domain_id AND d.organization_id=s.organization_id
 WHERE s.id=v_c.sender_id AND s.organization_id=p_org AND s.is_active AND d.verification_status='verified' AND d.charis_connected;
 IF v_provider IS DISTINCT FROM 'resend' THEN RAISE EXCEPTION 'Select a verified Resend sender in this approved campaign';END IF;
 SELECT EXISTS(SELECT 1 FROM public.charis_email_routes r
 JOIN public.email_provider_settings ep ON ep.provider=r.provider
 WHERE r.organization_id=p_org AND r.provider='resend' AND r.sender_id=v_c.sender_id
 AND r.enabled AND r.permission_confirmed AND r.allowed_kind='marketing' AND ep.enabled) INTO v_route;
 IF NOT v_route THEN RAISE EXCEPTION 'An administrator must authorise Resend for opted-in marketing and select this sender in Email Providers';END IF;
 IF EXISTS(SELECT 1 FROM public.charis_resend_broadcast_jobs WHERE organization_id=p_org AND campaign_id=p_campaign)
 THEN RAISE EXCEPTION 'This campaign already has a Resend broadcast attempt. Check its status before taking any action';END IF;
 v_run:=public.campaign_enqueue(p_org,p_campaign,p_revision);
 UPDATE public.campaign_runs SET status='paused',last_error='Resend Broadcast preparation. Do not resume this run in the standard worker.' WHERE id=v_run AND organization_id=p_org;
 SELECT COUNT(*) INTO v_count FROM public.email_deliveries WHERE organization_id=p_org AND run_id=v_run;
 IF v_count NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Current Resend rollout supports 1–50 eligible recipients per approved campaign. Use a smaller audience';END IF;
 IF (SELECT coalesce(sum(recipient_count),0) FROM public.charis_resend_broadcast_jobs WHERE organization_id=p_org AND status IN ('building','ready','submitting','submitted','uncertain') AND created_at>=date_trunc('month',now()))+v_count>public.delivery_monthly_limit(p_org) THEN RAISE EXCEPTION 'Charis monthly campaign sending limit reached';END IF;
 IF EXISTS (SELECT 1 FROM public.email_deliveries WHERE organization_id=p_org AND run_id=v_run GROUP BY lower(recipient_email) HAVING count(*)>1)
 THEN RAISE EXCEPTION 'Audience contains duplicate email addresses; correct it before sending';END IF;
 INSERT INTO public.charis_resend_broadcast_jobs(organization_id,campaign_id,run_id,initiated_by,recipient_count)
 VALUES(p_org,p_campaign,v_run,auth.uid(),v_count);
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'resend.broadcast_reserved','campaign',p_campaign::text,jsonb_build_object('run_id',v_run,'recipients',v_count));
 RETURN v_run;
END;$$;
REVOKE ALL ON FUNCTION public.charis_resend_broadcast_prepare(uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_resend_broadcast_prepare(uuid,uuid,integer) TO authenticated;

-- Prevent replay through existing Resume or automatic worker route.
CREATE OR REPLACE FUNCTION public.charis_resend_disallow_worker_replay() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status IN ('queued','running') AND EXISTS (
  SELECT 1 FROM public.charis_resend_broadcast_jobs WHERE run_id=NEW.id
 ) THEN RAISE EXCEPTION 'Resend Broadcast runs cannot be resumed in the standard delivery worker'; END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS charis_resend_worker_replay_guard ON public.campaign_runs;
CREATE TRIGGER charis_resend_worker_replay_guard BEFORE UPDATE OF status ON public.campaign_runs
 FOR EACH ROW EXECUTE FUNCTION public.charis_resend_disallow_worker_replay();
-- Expand marketing purpose for Resend while leaving all existing provider routes unchanged.
CREATE OR REPLACE FUNCTION public.charis_email_route_save(p_org uuid,p_provider text,p_sender uuid,p_enabled boolean,p_confirmed boolean,p_kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.can_manage_senders(p_org) OR NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=p_org AND slug='charis-mfb' AND status='active')
 THEN RAISE EXCEPTION 'Charis administrator permission required';END IF;
 IF p_provider NOT IN ('resend','brevo','mailjet') THEN RAISE EXCEPTION 'Invalid provider'; END IF;
 IF p_kind NOT IN ('service','marketing') OR (p_kind='marketing' AND p_provider NOT IN ('resend','mailjet')) THEN
  RAISE EXCEPTION 'Provider marketing is unavailable';END IF;
 IF NOT EXISTS (SELECT 1 FROM public.sender_identities s JOIN public.sending_domains d ON d.id=s.domain_id AND d.organization_id=s.organization_id
 WHERE s.id=p_sender AND s.organization_id=p_org AND s.is_active AND d.provider=p_provider AND d.verification_status='verified' AND d.charis_connected)
 THEN RAISE EXCEPTION 'Select an active Charis-connected, verified sender';END IF;
 IF p_enabled AND NOT p_confirmed THEN RAISE EXCEPTION 'Provider marketing policy must be confirmed';END IF;
 IF p_enabled AND NOT EXISTS(SELECT 1 FROM public.email_provider_settings WHERE provider=p_provider AND enabled)
 THEN RAISE EXCEPTION 'Enable and verify provider first';END IF;
 INSERT INTO public.charis_email_routes(organization_id,provider,sender_id,enabled,permission_confirmed,confirmed_by,confirmed_at,allowed_kind)
 VALUES(p_org,p_provider,p_sender,p_enabled,p_confirmed,CASE WHEN p_confirmed THEN auth.uid() END,CASE WHEN p_confirmed THEN now() END,p_kind)
 ON CONFLICT(organization_id,provider) DO UPDATE SET sender_id=excluded.sender_id,enabled=excluded.enabled,
 permission_confirmed=excluded.permission_confirmed,confirmed_by=excluded.confirmed_by,confirmed_at=excluded.confirmed_at,allowed_kind=excluded.allowed_kind,updated_at=now();
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'email.route_configured','email_provider',p_provider,jsonb_build_object('sender_id',p_sender,'enabled',p_enabled,'message_kind',p_kind));
END;$$;
REVOKE ALL ON FUNCTION public.charis_email_route_save(uuid,text,uuid,boolean,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_email_route_save(uuid,text,uuid,boolean,boolean,text) TO authenticated;
COMMIT;
