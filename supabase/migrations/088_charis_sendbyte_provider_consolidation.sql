-- 088: Charis email provider consolidation and explicit SendByte selection.
-- Adds SendByte while retaining historical delivery records. No customer messages are sent.
BEGIN;
UPDATE public.campaign_runs SET status='paused',last_error='Legacy campaign studio retired; use Campaign Centre' WHERE status IN ('queued','running');
UPDATE public.charis_direct_messages SET status='paused',updated_at=now() WHERE preferred_provider IN ('mailjet','zeptomail') AND status IN ('queued','pending_approval','sending');
UPDATE public.charis_direct_messages SET preferred_provider=NULL WHERE preferred_provider IN ('mailjet','zeptomail');
-- Existing email campaigns without an explicit provider must not auto-select one.
UPDATE public.charis_direct_messages SET status='paused',updated_at=now()
 WHERE channel='email' AND preferred_provider IS NULL AND status IN ('queued','pending_approval','sending');
UPDATE public.sending_domains SET verification_status='revoked',updated_at=now() WHERE provider='mailjet';
UPDATE public.sender_identities SET is_active=false WHERE domain_id IN (SELECT id FROM public.sending_domains WHERE provider='mailjet');
DELETE FROM public.charis_email_routes WHERE provider='mailjet';
DELETE FROM public.charis_direct_provider_prefs WHERE provider='mailjet';
DELETE FROM public.email_provider_settings WHERE provider='mailjet';
ALTER TABLE public.email_provider_settings DROP CONSTRAINT IF EXISTS email_provider_settings_provider_check;
ALTER TABLE public.email_provider_settings ADD CONSTRAINT email_provider_settings_provider_check CHECK(provider IN ('sendbyte','resend','brevo'));
ALTER TABLE public.charis_email_routes DROP CONSTRAINT IF EXISTS charis_email_routes_provider_check;
ALTER TABLE public.charis_email_routes ADD CONSTRAINT charis_email_routes_provider_check CHECK(provider IN ('sendbyte','resend','brevo'));
ALTER TABLE public.charis_direct_provider_prefs DROP CONSTRAINT IF EXISTS charis_direct_provider_prefs_provider_check;
ALTER TABLE public.charis_direct_provider_prefs ADD CONSTRAINT charis_direct_provider_prefs_provider_check CHECK(provider IN ('sendbyte','resend','brevo'));
ALTER TABLE public.campaign_runs DROP CONSTRAINT IF EXISTS campaign_runs_provider_check;
ALTER TABLE public.campaign_runs ADD CONSTRAINT campaign_runs_provider_check CHECK(provider IN ('sendbyte','resend','brevo','mailjet'));
ALTER TABLE public.charis_direct_messages DROP CONSTRAINT IF EXISTS charis_direct_preferred_provider_075;
ALTER TABLE public.charis_direct_messages ADD CONSTRAINT charis_direct_preferred_provider_075 CHECK(preferred_provider IS NULL OR (channel='email' AND preferred_provider IN ('sendbyte','resend','brevo')));
INSERT INTO public.email_provider_settings(provider,enabled,health_status) VALUES('sendbyte',false,'unchecked') ON CONFLICT(provider) DO NOTHING;
ALTER TABLE public.charis_direct_messages DROP COLUMN IF EXISTS zepto_event_reference;
ALTER TABLE public.charis_direct_messages DROP COLUMN IF EXISTS zepto_transactional_acknowledged;
DROP FUNCTION IF EXISTS public.charis_direct_create_zepto_081(uuid,uuid,text,text,text,text,text,text,text,uuid[],uuid,jsonb,timestamptz,text);
DO $$
DECLARE r record; v_def text;
BEGIN
 FOR r IN SELECT p.oid::regprocedure AS signature,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('charis_provider_configure','charis_email_route_save','charis_direct_provider_save','charis_direct_create_provider_075','delivery_event','charis_direct_event_060','charis_direct_reconcile_060')
 LOOP
  v_def:=pg_get_functiondef(r.signature);
  v_def:=replace(v_def,$old$'resend','brevo','mailjet'$old$,$new$'sendbyte','resend','brevo'$new$);
  v_def:=replace(v_def,$old$v_rec.provider NOT IN ('resend','brevo','mailjet')$old$,$new$v_rec.provider NOT IN ('sendbyte','resend','brevo')$new$);
  v_def:=replace(v_def,$old$p_provider<>'mailjet'$old$,$new$p_provider NOT IN ('sendbyte','resend')$new$);
  IF r.proname='charis_direct_create_provider_075' THEN
   v_def:=replace(v_def,$old$IF p_provider IS NOT NULL THEN$old$,$new$IF p_provider IS NULL THEN RAISE EXCEPTION 'Choose an email provider.'; END IF;
 IF p_provider IS NOT NULL THEN$new$);
  END IF;
  EXECUTE v_def;
 END LOOP;
END $$;
DO $$
DECLARE r record;
BEGIN
 FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND (tablename LIKE 'charis_zoho_%' OR tablename LIKE 'charis_zeptomail_%' OR tablename ILIKE '%resubscribe%') LOOP
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated',r.tablename);
 END LOOP;
 FOR r IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND (p.proname LIKE 'charis_zoho_%' OR p.proname LIKE 'charis_zepto_%' OR p.proname ILIKE '%resubscribe%') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',r.signature);
 END LOOP;
END $$;
COMMIT;
NOTIFY pgrst, 'reload schema';
