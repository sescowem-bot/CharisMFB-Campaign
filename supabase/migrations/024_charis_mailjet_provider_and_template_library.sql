-- Migration 024 — Add Mailjet to Charis's existing provider registry.
-- This does not enable live sending, silently split an existing campaign,
-- or trust a sender that the provider has not verified.
-- Requires migrations 001–023. Review installed migrations before execution.
BEGIN;
ALTER TABLE public.email_provider_settings
 DROP CONSTRAINT IF EXISTS email_provider_settings_provider_check;
ALTER TABLE public.email_provider_settings
 ADD CONSTRAINT email_provider_settings_provider_check
 CHECK (provider IN ('resend','brevo','mailjet'));
INSERT INTO public.email_provider_settings
 (provider,enabled,health_status,daily_limit,minimum_interval_seconds)
VALUES ('mailjet',false,'unchecked',50,5)
ON CONFLICT (provider) DO NOTHING;
-- Charis company administrators can read provider connection state, but never API keys.
CREATE POLICY "charis admins read provider health"
 ON public.email_provider_settings FOR SELECT TO authenticated
 USING (EXISTS (
  SELECT 1 FROM public.organizations o
  WHERE o.slug='charis-mfb' AND public.can_manage_senders(o.id)
 ));

-- This dedicated admin RPC respects the single-company bank scope.
-- Do not weaken the original platform-global administrator RPCs.
CREATE FUNCTION public.charis_provider_configure(
 p_org uuid,p_provider text,p_enabled boolean DEFAULT NULL,
 p_daily integer DEFAULT NULL,p_interval integer DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.can_manage_senders(p_org) OR NOT EXISTS (
  SELECT 1 FROM public.organizations WHERE id=p_org AND slug='charis-mfb' AND status='active'
 ) THEN RAISE EXCEPTION 'Charis company administrator access required'; END IF;
 IF p_provider NOT IN ('resend','brevo','mailjet') THEN RAISE EXCEPTION 'Unknown provider'; END IF;
 IF p_provider='mailjet' AND p_enabled IS TRUE THEN
  RAISE EXCEPTION 'Mailjet customer sending is disabled pending verified sender and delivery-event controls'; END IF;
 IF p_daily IS NOT NULL AND p_daily NOT BETWEEN 1 AND 100000 THEN RAISE EXCEPTION 'Invalid daily cap'; END IF;
 IF p_interval IS NOT NULL AND p_interval NOT BETWEEN 1 AND 3600 THEN RAISE EXCEPTION 'Invalid request interval'; END IF;
 UPDATE public.email_provider_settings
 SET enabled=coalesce(p_enabled,enabled),
 daily_limit=coalesce(p_daily,daily_limit),
 minimum_interval_seconds=coalesce(p_interval,minimum_interval_seconds),
 updated_at=now()
 WHERE provider=p_provider;
 IF NOT FOUND THEN RAISE EXCEPTION 'Provider unavailable'; END IF;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'provider.configured','email_provider',p_provider,
 jsonb_build_object('enabled',p_enabled,'daily_cap',p_daily,'interval',p_interval));
END;$$;
REVOKE ALL ON FUNCTION public.charis_provider_configure(uuid,text,boolean,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_provider_configure(uuid,text,boolean,integer,integer) TO authenticated;

-- Preserve the existing bank approval, consent and suppression restrictions.
-- Mailjet bulk dispatch is NOT activated by this migration. Mailjet identity
-- verification, webhook authentication and sending acceptance are prerequisites.
COMMIT;
