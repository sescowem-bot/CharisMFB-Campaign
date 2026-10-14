-- Charis migration 025: per-recipient provider assignment, atomic quota reservations,
-- central preferences and provider-specific delivery reconciliation.
-- Apply after 024. No keys or automatic live sending are introduced.
BEGIN;

-- A domain and mailbox can be verified separately by several email providers.
-- Keep tenant/provider uniqueness; do not alter existing sender IDs.
ALTER TABLE public.sending_domains DROP CONSTRAINT IF EXISTS sending_domains_domain_key;
DROP INDEX IF EXISTS public.workspace_domain_unique;
ALTER TABLE public.sending_domains ADD CONSTRAINT charis_domain_by_provider_unique UNIQUE(organization_id,provider,domain);
ALTER TABLE public.sender_identities DROP CONSTRAINT IF EXISTS sender_identities_organization_id_from_email_key;
ALTER TABLE public.sender_identities ADD CONSTRAINT charis_sender_by_provider_unique UNIQUE(organization_id,domain_id,from_email);
ALTER TABLE public.campaign_runs ADD COLUMN IF NOT EXISTS message_kind text NOT NULL DEFAULT 'marketing' CHECK(message_kind IN ('marketing','service'));
-- Existing campaigns remain marketing. Only a future bank-approved service workflow may create service runs.
ALTER TABLE public.email_deliveries ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE public.email_deliveries ADD COLUMN IF NOT EXISTS route_sender_id uuid;
ALTER TABLE public.email_deliveries ADD CONSTRAINT email_deliveries_route_sender_fk
 FOREIGN KEY (organization_id,route_sender_id) REFERENCES public.sender_identities(organization_id,id);
CREATE INDEX IF NOT EXISTS charis_email_provider_outcomes ON public.email_deliveries(organization_id,run_id,provider,status);
ALTER TABLE public.campaign_runs DROP CONSTRAINT IF EXISTS campaign_runs_provider_check;
ALTER TABLE public.campaign_runs ADD CONSTRAINT campaign_runs_provider_check CHECK (provider IN ('resend','brevo','mailjet'));

-- One route per organisation/provider. No automatic route activation.
CREATE TABLE public.charis_email_routes (
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 provider text NOT NULL CHECK (provider IN ('resend','brevo','mailjet')),
 sender_id uuid NOT NULL,
 enabled boolean NOT NULL DEFAULT false,
 -- Explicit attestation is a configuration safeguard, not evidence of provider approval.
 permission_confirmed boolean NOT NULL DEFAULT false,
 allowed_kind text NOT NULL DEFAULT 'service' CHECK(allowed_kind IN ('service','marketing')),
 confirmed_by uuid REFERENCES auth.users(id),
 confirmed_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (organization_id,provider),
 FOREIGN KEY (organization_id,sender_id) REFERENCES public.sender_identities(organization_id,id)
);
ALTER TABLE public.charis_email_routes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charis_email_routes FROM PUBLIC,anon,authenticated;
CREATE POLICY "charis admins view email routes" ON public.charis_email_routes FOR SELECT TO authenticated
 USING(public.can_manage_senders(organization_id));
GRANT SELECT ON public.charis_email_routes TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_email_route_save(p_org uuid,p_provider text,p_sender uuid,p_enabled boolean,p_confirmed boolean,p_kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.can_manage_senders(p_org) OR NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=p_org AND slug='charis-mfb' AND status='active')
 THEN RAISE EXCEPTION 'Charis administrator permission required'; END IF;
 IF p_provider NOT IN ('resend','brevo','mailjet') THEN RAISE EXCEPTION 'Invalid email provider'; END IF;
 IF p_kind NOT IN ('service','marketing') OR (p_kind='marketing' AND p_provider<>'mailjet') THEN
  RAISE EXCEPTION 'This provider adapter supports transactional or service messages only'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.sender_identities s JOIN public.sending_domains d ON d.id=s.domain_id AND d.organization_id=s.organization_id
  WHERE s.id=p_sender AND s.organization_id=p_org AND s.is_active AND d.provider=p_provider AND d.verification_status='verified')
 THEN RAISE EXCEPTION 'Select an active sender verified with this provider'; END IF;
 IF p_enabled AND NOT p_confirmed THEN RAISE EXCEPTION 'Provider sending purpose and account policies must be confirmed'; END IF;
 IF p_enabled AND NOT EXISTS (SELECT 1 FROM public.email_provider_settings WHERE provider=p_provider AND enabled)
 THEN RAISE EXCEPTION 'Enable and verify the provider first'; END IF;
 INSERT INTO public.charis_email_routes(organization_id,provider,sender_id,enabled,permission_confirmed,confirmed_by,confirmed_at,allowed_kind)
 VALUES(p_org,p_provider,p_sender,p_enabled,p_confirmed,CASE WHEN p_confirmed THEN auth.uid() END,CASE WHEN p_confirmed THEN now() END,p_kind)
 ON CONFLICT(organization_id,provider) DO UPDATE SET sender_id=excluded.sender_id,enabled=excluded.enabled,
 permission_confirmed=excluded.permission_confirmed,confirmed_by=excluded.confirmed_by,confirmed_at=excluded.confirmed_at,allowed_kind=excluded.allowed_kind,updated_at=now();
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'email.route_configured','email_provider',p_provider,
 jsonb_build_object('sender_id',p_sender,'enabled',p_enabled,'sending_policy_confirmed',p_confirmed,'message_kind',p_kind));
END;$$;
REVOKE ALL ON FUNCTION public.charis_email_route_save(uuid,text,uuid,boolean,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_email_route_save(uuid,text,uuid,boolean,boolean,text) TO authenticated;

-- Permit enabling Mailjet only after its sender/domain validation and webhook secret are configured.
-- The application still checks a sender freshly with Mailjet before dispatch.
CREATE OR REPLACE FUNCTION public.charis_provider_configure(
 p_org uuid,p_provider text,p_enabled boolean DEFAULT NULL,p_daily integer DEFAULT NULL,p_interval integer DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.can_manage_senders(p_org) OR NOT EXISTS (
  SELECT 1 FROM public.organizations WHERE id=p_org AND slug='charis-mfb' AND status='active'
 ) THEN RAISE EXCEPTION 'Charis company administrator access required'; END IF;
 IF p_provider NOT IN ('resend','brevo','mailjet') THEN RAISE EXCEPTION 'Unknown provider'; END IF;
 IF p_daily IS NOT NULL AND p_daily NOT BETWEEN 1 AND 100000 THEN RAISE EXCEPTION 'Invalid daily cap'; END IF;
 IF p_interval IS NOT NULL AND p_interval NOT BETWEEN 1 AND 3600 THEN RAISE EXCEPTION 'Invalid request interval'; END IF;
 UPDATE public.email_provider_settings SET enabled=coalesce(p_enabled,enabled),daily_limit=coalesce(p_daily,daily_limit),
 minimum_interval_seconds=coalesce(p_interval,minimum_interval_seconds),updated_at=now() WHERE provider=p_provider;
 IF NOT FOUND THEN RAISE EXCEPTION 'Provider unavailable'; END IF;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'provider.configured','email_provider',p_provider,jsonb_build_object('enabled',p_enabled,'daily_cap',p_daily,'interval',p_interval));
END;$$;

-- Atomic one-recipient claim -> verified provider selection -> daily quota reservation.
-- Priority is proportional to unused daily quotas. No automatic retry of unknown sends.
CREATE OR REPLACE FUNCTION public.delivery_begin(p_id uuid,p_lease uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.email_deliveries; r public.campaign_runs; p public.email_provider_settings;
 v_route record;v_best record;v_usage integer;v_test integer;v_monthly integer;v_used integer;
 v_fraction numeric;v_best_fraction numeric:=2;v_ready boolean:=false;v_selected boolean:=false;v_earliest timestamptz;
BEGIN
 -- Locks in a stable order: all provider settings then organisation then run/delivery.
 PERFORM 1 FROM public.email_provider_settings ORDER BY provider FOR UPDATE;
 SELECT r0.* INTO r FROM public.campaign_runs r0 JOIN public.email_deliveries q ON q.run_id=r0.id WHERE q.id=p_id;
 IF NOT FOUND THEN RETURN 'unavailable'; END IF;
 PERFORM 1 FROM public.organizations WHERE id=r.organization_id FOR UPDATE;
 SELECT * INTO r FROM public.campaign_runs WHERE id=r.id FOR UPDATE;
 SELECT * INTO d FROM public.email_deliveries WHERE id=p_id AND status='leased' AND lease_token=p_lease AND lease_until>now() FOR UPDATE;
 IF NOT FOUND THEN RETURN 'lease_lost'; END IF;
 IF r.status NOT IN ('queued','running') THEN
  UPDATE public.email_deliveries SET status='pending',lease_token=null,lease_until=null WHERE id=p_id;RETURN 'run_inactive';END IF;
 -- Prevent multiple contacts sharing an email from being mailed twice in the same run.
 IF EXISTS(SELECT 1 FROM public.email_deliveries q WHERE q.run_id=d.run_id AND lower(q.recipient_email)=lower(d.recipient_email) AND q.id<d.id) THEN
  UPDATE public.email_deliveries SET status='skipped',reason='duplicate_email_in_campaign',lease_token=null,lease_until=null WHERE id=p_id;
  RETURN 'duplicate';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.contacts c WHERE c.id=d.contact_id AND c.organization_id=d.organization_id AND lower(c.email)=lower(d.recipient_email) AND c.consent_status='granted' AND c.unsubscribed_at IS NULL AND c.archived_at IS NULL)
 OR EXISTS(SELECT 1 FROM public.email_suppressions x WHERE x.organization_id=d.organization_id AND lower(x.email)=lower(d.recipient_email)) THEN
  UPDATE public.email_deliveries SET status='skipped',reason='consent_or_suppression',lease_token=null,lease_until=null WHERE id=p_id; RETURN 'suppressed';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=d.organization_id AND status='active') THEN
  UPDATE public.campaign_runs SET status='paused',last_error='Charis workspace inactive' WHERE id=r.id;
  UPDATE public.email_deliveries SET status='pending',lease_token=null,lease_until=null WHERE id=p_id;RETURN 'not_ready';END IF;
 v_monthly=public.delivery_monthly_limit(d.organization_id);
 SELECT count(*) INTO v_used FROM public.delivery_quota_reservations WHERE organization_id=d.organization_id AND reserved_at>=(date_trunc('month',now() at time zone 'UTC') at time zone 'UTC');
 IF v_used>=v_monthly THEN
  UPDATE public.campaign_runs SET status='paused',last_error='Monthly allowance reached' WHERE id=r.id;
  UPDATE public.email_deliveries SET status='pending',lease_token=null,lease_until=null WHERE id=p_id;RETURN 'company_limit'; END IF;
 -- All routes require explicit administrator activation and verified sender identities.
 FOR v_route IN SELECT cr.provider,cr.sender_id,ep.daily_limit,ep.last_dispatch_at,ep.minimum_interval_seconds
  FROM public.charis_email_routes cr JOIN public.email_provider_settings ep ON ep.provider=cr.provider
  JOIN public.sender_identities s ON s.id=cr.sender_id AND s.organization_id=cr.organization_id
  JOIN public.sending_domains sd ON sd.id=s.domain_id AND sd.organization_id=cr.organization_id AND sd.provider=cr.provider
  WHERE cr.organization_id=d.organization_id AND cr.enabled AND cr.permission_confirmed AND ep.enabled AND cr.allowed_kind=r.message_kind
  AND (d.provider IS NULL OR d.attempts=0 OR cr.provider=d.provider)
  AND s.is_active AND sd.verification_status='verified'
  ORDER BY cr.provider
 LOOP
  v_ready:=true;
  SELECT count(*) INTO v_usage FROM public.delivery_quota_reservations WHERE provider=v_route.provider AND reserved_at>=(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC');
  SELECT count(*) INTO v_test FROM public.email_test_attempts t JOIN public.sender_identities s ON s.id=t.sender_id
   JOIN public.sending_domains sd ON sd.id=s.domain_id WHERE sd.provider=v_route.provider AND t.created_at>=(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC');
  v_usage:=v_usage+v_test;
  IF v_usage>=v_route.daily_limit THEN CONTINUE;END IF;
  IF v_route.last_dispatch_at>now()-make_interval(secs=>v_route.minimum_interval_seconds) THEN
   v_earliest:=least(coalesce(v_earliest,'infinity'::timestamptz),v_route.last_dispatch_at+make_interval(secs=>v_route.minimum_interval_seconds));CONTINUE;
  END IF;
  v_fraction:=v_usage::numeric/greatest(1,v_route.daily_limit);
  IF v_fraction<v_best_fraction THEN v_best_fraction:=v_fraction;v_best:=v_route;v_selected:=true;END IF;
 END LOOP;
 IF NOT v_selected THEN
  UPDATE public.email_deliveries SET status='pending',lease_token=null,lease_until=null,
   available_at=coalesce(v_earliest,(date_trunc('day',now() at time zone 'UTC')+interval '1 day') at time zone 'UTC')
  WHERE id=p_id;
  IF NOT v_ready THEN UPDATE public.campaign_runs SET status='paused',last_error='No approved provider route and verified sender' WHERE id=r.id;RETURN 'routes_not_configured'; END IF;
  RETURN 'provider_limit';
 END IF;
 UPDATE public.campaign_runs SET status='running' WHERE id=r.id AND status='queued';
 UPDATE public.email_deliveries SET provider=v_best.provider,route_sender_id=v_best.sender_id,status='dispatching',attempts=attempts+1,
  quota_at=coalesce(quota_at,now()),lease_until=now()+interval '2 minutes',updated_at=now() WHERE id=d.id;
 INSERT INTO public.delivery_quota_reservations(delivery_id,attempt,organization_id,provider)
 VALUES(d.id,d.attempts+1,d.organization_id,v_best.provider);
 UPDATE public.email_provider_settings SET last_dispatch_at=now() WHERE provider=v_best.provider;
 RETURN 'dispatch';
END;$$;

-- Worker-only context exposes only the selected verified sender and delivery snapshot.
CREATE OR REPLACE FUNCTION public.charis_delivery_context(p_id uuid,p_lease uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_out jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
 SELECT jsonb_build_object('delivery',to_jsonb(q),'run',to_jsonb(r),
  'sender',to_jsonb(s),'domain',to_jsonb(sd)) INTO v_out
 FROM public.email_deliveries q JOIN public.campaign_runs r ON r.id=q.run_id AND r.organization_id=q.organization_id
 JOIN public.sender_identities s ON s.id=q.route_sender_id AND s.organization_id=q.organization_id
 JOIN public.sending_domains sd ON sd.id=s.domain_id AND sd.organization_id=q.organization_id
 WHERE q.id=p_id AND q.lease_token=p_lease AND q.status='dispatching' AND q.lease_until>now()
 AND q.provider=sd.provider AND s.is_active AND sd.verification_status='verified';
 IF v_out IS NULL THEN RAISE EXCEPTION 'Verified delivery sender is unavailable'; END IF;
 RETURN v_out;
END;$$;
REVOKE ALL ON FUNCTION public.charis_delivery_context(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.charis_delivery_context(uuid,uuid) TO service_role;

-- Match events by the actual recipient provider, never by the run's original sender.
CREATE OR REPLACE FUNCTION public.delivery_event(p_provider text,p_key text,p_message text,p_type text,p_time timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.email_deliveries;v_event bigint;
BEGIN
 IF p_provider NOT IN ('resend','brevo','mailjet') OR p_type NOT IN ('delivered','bounce','complaint','unsubscribe','blocked','opened','clicked','delayed','accepted','failed')
 OR length(p_key)>200 OR length(p_message)>300 THEN RAISE EXCEPTION 'Invalid provider event'; END IF;
 SELECT q.* INTO d FROM public.email_deliveries q JOIN public.campaign_runs r ON r.id=q.run_id
 WHERE coalesce(q.provider,r.provider)=p_provider AND q.provider_message_id=trim(both '<>' from p_message) FOR UPDATE OF q;
 INSERT INTO public.email_delivery_events(provider,event_key,provider_message_id,event_type,occurred_at,delivery_id)
 VALUES(p_provider,p_key,trim(both '<>' from p_message),p_type,p_time,d.id)
 ON CONFLICT(provider,event_key) DO NOTHING RETURNING id INTO v_event;
 IF v_event IS NULL AND d.id IS NOT NULL THEN
  UPDATE public.email_delivery_events SET delivery_id=d.id WHERE provider=p_provider AND event_key=p_key
   AND delivery_id IS NULL AND provider_message_id=trim(both '<>' from p_message) RETURNING id INTO v_event;
 END IF;
 IF v_event IS NULL OR d.id IS NULL THEN RETURN; END IF;
 IF p_type IN ('bounce','complaint','unsubscribe','blocked') THEN
  INSERT INTO public.email_suppressions(organization_id,email,reason) VALUES(d.organization_id,lower(d.recipient_email),
  CASE WHEN p_type='unsubscribe' THEN 'unsubscribe' WHEN p_type='complaint' THEN 'complaint' WHEN p_type='blocked' THEN 'blocked' ELSE 'bounce' END)
  ON CONFLICT(organization_id,email) DO NOTHING;
  UPDATE public.contacts SET consent_status=CASE WHEN p_type='unsubscribe' THEN 'denied' ELSE consent_status END,
   unsubscribed_at=CASE WHEN p_type='unsubscribe' THEN coalesce(unsubscribed_at,now()) ELSE unsubscribed_at END,updated_at=now()
  WHERE organization_id=d.organization_id AND lower(email)=lower(d.recipient_email);
  UPDATE public.email_deliveries SET status=CASE WHEN p_type='bounce' THEN 'bounced' WHEN p_type='complaint' THEN 'complained' WHEN p_type='unsubscribe' THEN 'unsubscribed' ELSE 'failed' END,updated_at=now() WHERE id=d.id;
 ELSIF p_type='delivered' AND d.status NOT IN ('bounced','complained','unsubscribed','failed') THEN
  UPDATE public.email_deliveries SET status='delivered',updated_at=now() WHERE id=d.id;
 ELSIF p_type='failed' AND d.status='accepted' THEN UPDATE public.email_deliveries SET status='failed',updated_at=now() WHERE id=d.id;
 END IF;
END;$$;

-- Preserve webhook race reconciliation for the actual provider on the delivery record.
CREATE OR REPLACE FUNCTION public.delivery_finish(p_id uuid,p_lease uuid,p_status text,p_message text,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.email_deliveries;ev public.email_delivery_events;v_provider text;
BEGIN
 IF p_status NOT IN ('accepted','failed','unknown','retry') THEN RAISE EXCEPTION 'Invalid delivery result';END IF;
 SELECT * INTO d FROM public.email_deliveries WHERE id=p_id AND lease_token=p_lease AND status IN ('dispatching','unknown') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Dispatch lease unavailable';END IF;
 IF p_status='accepted' AND nullif(p_message,'') IS NULL THEN RAISE EXCEPTION 'Provider acknowledgement required';END IF;
 UPDATE public.email_deliveries SET status=CASE WHEN p_status='retry' AND attempts<3 THEN 'pending' WHEN p_status='retry' THEN 'failed' ELSE p_status END,
  provider_message_id=nullif(trim(both '<>' from p_message),''),reason=left(p_reason,200),available_at=now()+interval '1 minute',
  lease_token=null,lease_until=null,updated_at=now() WHERE id=p_id;
 IF p_status='accepted' THEN
  v_provider=d.provider;
  FOR ev IN SELECT * FROM public.email_delivery_events WHERE provider=v_provider AND provider_message_id=trim(both '<>' from p_message) AND delivery_id IS NULL LOOP
   PERFORM public.delivery_event(ev.provider,ev.event_key,ev.provider_message_id,ev.event_type,ev.occurred_at);
  END LOOP;
 END IF;
END;$$;

-- Resend, Brevo and Mailjet keep one central status summary, broken down by provider.
CREATE OR REPLACE FUNCTION public.charis_delivery_provider_summary(p_org uuid,p_run uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_out jsonb;
BEGIN
 IF NOT(public.is_organization_member(p_org) OR public.is_platform_super_admin()) THEN RAISE EXCEPTION 'Not authorised';END IF;
 SELECT coalesce(jsonb_agg(x),'[]'::jsonb) INTO v_out FROM (
  SELECT coalesce(q.provider,r.provider) AS provider,q.status,count(*)::integer AS count
  FROM public.email_deliveries q JOIN public.campaign_runs r ON r.id=q.run_id
  WHERE q.organization_id=p_org AND q.run_id=p_run GROUP BY 1,2 ORDER BY 1,2) x;
 RETURN v_out;
END;$$;
REVOKE ALL ON FUNCTION public.charis_delivery_provider_summary(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_delivery_provider_summary(uuid,uuid) TO authenticated;


-- Maintain compatibility for historical sender-management RPCs after tightening uniqueness.
create or replace function public.email_sender_save(p_org uuid,p_domain uuid,p_name text,p_email text,p_reply text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_domain text; v_id uuid;
begin
 if not public.can_manage_senders(p_org) then raise exception 'Not authorized'; end if;
 select domain into v_domain from public.sending_domains where id=p_domain and organization_id=p_org and verification_status='verified' for update;
 if not found then raise exception 'Verify the domain first'; end if;
 if p_name is null or length(trim(p_name)) not between 1 and 100 or p_name ~ '[<>\r\n]' then raise exception 'Invalid sender name'; end if;
 if p_email is null or p_reply is null or length(p_email)>254 or length(p_reply)>254 or p_email !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9.-]+$' or p_reply !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9.-]+$' or split_part(p_email,'@',2)<>v_domain then raise exception 'Invalid sender email'; end if;
 insert into public.sender_identities(organization_id,domain_id,from_name,from_email,reply_to) values(p_org,p_domain,trim(p_name),p_email,p_reply)
 on conflict(organization_id,domain_id,from_email) do update set from_name=excluded.from_name,reply_to=excluded.reply_to,is_active=true returning id into v_id;
 insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id) values(p_org,auth.uid(),'sender.saved','sender_identity',v_id::text);
 return v_id;
end;$$;

create or replace function public.owner_connect_resend(p_actor uuid,p_domain text,p_provider_id text,p_records jsonb,p_name text,p_email text,p_reply text,p_address text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_domain uuid; v_sender uuid;
begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from public.platform_staff where user_id=p_actor and role='super_admin') then raise exception 'Not authorized'; end if;
 select organization_id into v_org from public.platform_workspace where id for update;
 if v_org is null or not exists(select 1 from public.organizations where id=v_org and status='active') then raise exception 'Active owner workspace required'; end if;
 if p_domain is null or p_domain !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$' or length(p_domain)>253 or p_provider_id is null or length(p_provider_id) not between 1 and 200 then raise exception 'Invalid domain'; end if;
 if p_email is null or split_part(p_email,'@',2)<>p_domain or p_email !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+$' or p_reply is null or p_reply !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+$' or p_name is null or length(trim(p_name)) not between 1 and 100 or p_name ~ '[<>\r\n]' or length(trim(coalesce(p_address,''))) not between 6 and 500 then raise exception 'Valid sender details and postal address required'; end if;
 insert into public.sending_domains(organization_id,domain,provider,provider_domain_id,verification_status,dns_records,ownership_method,last_checked_at,created_by)
 values(v_org,p_domain,'resend',p_provider_id,'verified',p_records,'provider_account',now(),p_actor)
 on conflict(organization_id,provider,domain) do update set provider='resend',provider_domain_id=excluded.provider_domain_id,verification_status='verified',dns_records=excluded.dns_records,ownership_method='provider_account',last_checked_at=now(),updated_at=now() returning id into v_domain;
 insert into public.sender_identities(organization_id,domain_id,from_name,from_email,reply_to)
 values(v_org,v_domain,p_name,p_email,p_reply)
 on conflict(organization_id,domain_id,from_email) do update set domain_id=excluded.domain_id,from_name=excluded.from_name,reply_to=excluded.reply_to,is_active=true returning id into v_sender;
 update public.organization_branding set postal_address=trim(p_address),updated_at=now() where organization_id=v_org;
 update public.email_provider_settings set enabled=true,health_status='healthy',checked_at=now(),updated_at=now() where provider='resend';
 insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id) values(v_org,p_actor,'owner.resend_connected','sender_identity',v_sender::text);
 return v_sender;
end;$$;

-- Charis's monthly sending budget is independent of retired multi-tenant subscription plans.
CREATE TABLE public.charis_email_monthly_budget(
 organization_id uuid PRIMARY KEY REFERENCES public.organizations(id),
 monthly_limit integer NOT NULL DEFAULT 10000 CHECK(monthly_limit BETWEEN 1 AND 1000000),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.charis_email_monthly_budget ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charis_email_monthly_budget FROM PUBLIC,anon,authenticated;
INSERT INTO public.charis_email_monthly_budget(organization_id,monthly_limit)
 SELECT id,10000 FROM public.organizations WHERE slug='charis-mfb' ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.delivery_monthly_limit(p_org uuid) RETURNS integer
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_cap integer;v_value jsonb;
BEGIN
 SELECT b.monthly_limit INTO v_cap FROM public.charis_email_monthly_budget b
 JOIN public.organizations o ON o.id=b.organization_id AND o.slug='charis-mfb' WHERE b.organization_id=p_org;
 IF found THEN RETURN v_cap;END IF;
 IF EXISTS(SELECT 1 FROM public.platform_workspace WHERE organization_id=p_org) THEN
  RETURN (SELECT monthly_email_limit FROM public.platform_workspace WHERE organization_id=p_org);
 END IF;
 SELECT coalesce(s.quota_overrides->'monthly_emails',p.limits->'monthly_emails') INTO v_value
 FROM public.organization_subscriptions s JOIN public.subscription_plans p ON p.id=s.plan_id
 WHERE s.organization_id=p_org AND s.status='active' AND p.is_active
 AND (s.starts_at IS NULL OR s.starts_at<=now()) AND (s.expires_at IS NULL OR s.expires_at>now());
 IF v_value IS NULL OR jsonb_typeof(v_value)<>'number' OR v_value::text !~ '^[0-9]+$' THEN RETURN 0;END IF;
 RETURN least((v_value::text)::numeric,10000000)::integer;
END;$$;

CREATE OR REPLACE FUNCTION public.charis_email_budget_save(p_org uuid,p_limit integer)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.can_manage_senders(p_org) OR NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=p_org AND slug='charis-mfb' AND status='active')
 THEN RAISE EXCEPTION 'Charis administrator required';END IF;
 IF p_limit NOT BETWEEN 1 AND 1000000 THEN RAISE EXCEPTION 'Invalid monthly budget';END IF;
 INSERT INTO public.charis_email_monthly_budget(organization_id,monthly_limit)
 VALUES(p_org,p_limit) ON CONFLICT(organization_id) DO UPDATE SET monthly_limit=excluded.monthly_limit,updated_at=now();
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'email.monthly_budget_set','email_budget',p_org::text,jsonb_build_object('monthly_limit',p_limit));
END;$$;
REVOKE ALL ON FUNCTION public.charis_email_budget_save(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_email_budget_save(uuid,integer) TO authenticated;

COMMIT;
